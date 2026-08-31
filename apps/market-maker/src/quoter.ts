import { api, ApiError, BotAuth } from "./api";
import { MarketSpec } from "./config";
import { IndexFeed } from "./feed";
import { jitter, log, randInt, sleep } from "./util";

const TICK_MS = 2500;
/** requote when the index moves more than this fraction from the last quoted mid */
const REQUOTE_DRIFT = 0.0002;
/** requote at least this often even in a flat market, so the book stays fresh */
const FORCE_REQUOTE_TICKS = 12;
const LEVERAGE = 5;
const BALANCE_FLOOR_CENTS = 500_000_000; // $5M
const TOPUP_CENTS = 10_000_000_000; // $100M

type Quote = { side: "buy" | "sell"; price: number; qty: number; levelIndex: number };
type TrackedLevel = { orderId: string; price: number };

/** how far a level's resting price can drift from its ideal target before it gets replaced,
 * as a fraction of one price step — keeps most ticks from touching anything at all, so the
 * book's visible movement comes from real fills consuming resting orders, not from us */
const REPLACE_TOLERANCE = 0.5;

/**
 * Maintains a two-sided ladder anchored to the external index price. All orders
 * go through the public API so the whole engine pipeline stays exercised.
 *
 * Diffs against what's already resting instead of cancelling and replacing the whole
 * ladder every tick — cancelling+placing all `levels * 2` orders together every few
 * seconds made the book look like it snapped between "just replaced" and "stale" instead
 * of moving gradually. Levels that are still close enough to their target price are left
 * alone; only the ones that actually drifted get touched, and those get placed with a
 * small stagger instead of firing all at once.
 */
export async function runQuoter(auth: BotAuth, feed: IndexFeed, spec: MarketSpec) {
  const tag = `quoter:${spec.symbol}`;
  // keyed by "side-levelIndex" so the same conceptual level can be compared tick to tick
  // even as its target price drifts with the index
  let trackedLevels = new Map<string, TrackedLevel>();
  let lastMid = 0;
  let ticksSinceQuote = 0;
  let loops = 0;

  while (true) {
    await sleep(jitter(TICK_MS));
    try {
      if (loops++ % 100 === 0) await topUp(auth, tag);

      const mid = feed.price(spec.symbol);
      if (!mid) continue;

      ticksSinceQuote++;
      const drifted = lastMid === 0 || Math.abs(mid - lastMid) / lastMid >= REQUOTE_DRIFT;
      if (!drifted && ticksSinceQuote < FORCE_REQUOTE_TICKS) continue;

      const target = buildLadder(mid, spec);
      const tolerance = Math.max(1, Math.round((mid * spec.stepBps) / 10_000) * REPLACE_TOLERANCE);

      const nextTracked = new Map<string, TrackedLevel>();
      const toCancel: { key: string; orderId: string }[] = [];
      const toPlace: Quote[] = [];

      for (const quote of target) {
        const key = `${quote.side}-${quote.levelIndex}`;
        const existing = trackedLevels.get(key);
        if (existing && Math.abs(existing.price - quote.price) <= tolerance) {
          nextTracked.set(key, existing); // close enough — leave this resting order alone
          continue;
        }
        if (existing) toCancel.push({ key, orderId: existing.orderId });
        toPlace.push(quote);
      }
      // levels that no longer exist in the new target at all (spec.levels shrank, or the
      // ladder came up shorter this round) still need cleaning up
      for (const [key, lvl] of trackedLevels) {
        if (!nextTracked.has(key) && !toPlace.some((q) => `${q.side}-${q.levelIndex}` === key)) {
          toCancel.push({ key, orderId: lvl.orderId });
        }
      }

      // a cancel that fails for any reason other than "already terminal" (400) must not be
      // dropped — otherwise it orphans a resting order in the engine's book forever, since
      // nothing else will ever try to cancel it again. Keep the old level tracked so it's
      // retried next round instead of placing a duplicate on top of it.
      const cancelResults = await Promise.allSettled(toCancel.map((c) => api.cancelOrder(auth, c.orderId)));
      let failedCancels = 0;
      cancelResults.forEach((result, i) => {
        const { key, orderId } = toCancel[i]!;
        if (result.status === "rejected" && !(result.reason instanceof ApiError && result.reason.status === 400)) {
          failedCancels++;
          nextTracked.set(key, { orderId, price: trackedLevels.get(key)!.price });
        }
      });
      if (failedCancels > 0) log(tag, `${failedCancels} cancel(s) failed, retrying next tick`);

      for (const quote of toPlace) {
        const key = `${quote.side}-${quote.levelIndex}`;
        if (nextTracked.has(key)) continue; // its cancel failed above — don't place a duplicate
        if (toPlace.indexOf(quote) > 0) await sleep(jitter(150)); // stagger so a multi-level replace doesn't snap all at once
        try {
          const result = await api.placeOrder(auth, {
            orderType: "limit",
            symbol: spec.symbol,
            side: quote.side,
            price: quote.price,
            qty: quote.qty,
            leverage: LEVERAGE,
          });
          if (result.order.status === "open" || result.order.status === "partially_filled") {
            nextTracked.set(key, { orderId: result.order.orderId, price: quote.price });
          }
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 400)) throw err;
        }
      }

      trackedLevels = nextTracked;
      lastMid = mid;
      ticksSinceQuote = 0;
    } catch (err) {
      log(tag, `tick failed: ${(err as Error).message}`);
      await sleep(5000);
    }
  }
}

/** Cancel resting orders left behind by a previous run so the book starts clean. */
export async function cancelStaleOrders(auth: BotAuth, tag: string) {
  try {
    const open = await api.openOrders(auth);
    await Promise.allSettled(open.map((order) => api.cancelOrder(auth, order.id)));
    if (open.length > 0) log(tag, `cancelled ${open.length} stale orders`);
  } catch (err) {
    log(tag, `stale-order cleanup failed: ${(err as Error).message}`);
  }
}

export async function topUp(auth: BotAuth, tag: string, floor = BALANCE_FLOOR_CENTS, amount = TOPUP_CENTS) {
  try {
    const balance = await api.balance(auth).catch(() => null);
    if (!balance || balance.available < floor) {
      await api.onramp(auth, amount);
      log(tag, `on-ramped $${(amount / 100).toLocaleString()}`);
    }
  } catch (err) {
    log(tag, `top-up failed: ${(err as Error).message}`);
  }
}

export function buildLadder(mid: number, spec: MarketSpec): Quote[] {
  const quotes: Quote[] = [];
  let prevBid = Infinity;
  let prevAsk = 0;

  for (let i = 0; i < spec.levels; i++) {
    const offsetBps = spec.spreadBps + i * spec.stepBps;
    let bid = Math.floor(mid * (1 - offsetBps / 10_000));
    let ask = Math.ceil(mid * (1 + offsetBps / 10_000));
    // keep levels strictly ordered even when the bps offset rounds to the same cent
    bid = Math.min(bid, prevBid - 1);
    ask = Math.max(ask, prevAsk + 1);
    prevBid = bid;
    prevAsk = ask;
    if (bid <= 0) break;

    // deeper levels carry more size, like a real book
    const depthBoost = 1 + i * 0.5;
    quotes.push({ side: "buy", price: bid, qty: sized(spec, depthBoost), levelIndex: i });
    quotes.push({ side: "sell", price: ask, qty: sized(spec, depthBoost), levelIndex: i });
  }
  return quotes;
}

function sized(spec: MarketSpec, boost: number) {
  return Math.max(spec.minQty, Math.round(randInt(spec.quoteSize[0], spec.quoteSize[1]) * boost));
}
