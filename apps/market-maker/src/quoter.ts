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

type Quote = { side: "buy" | "sell"; price: number; qty: number };

/**
 * Maintains a two-sided ladder anchored to the external index price. All orders
 * go through the public API so the whole engine pipeline stays exercised.
 */
export async function runQuoter(auth: BotAuth, feed: IndexFeed, spec: MarketSpec) {
  const tag = `quoter:${spec.symbol}`;
  let tracked: string[] = [];
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

      await Promise.allSettled(tracked.map((orderId) => api.cancelOrder(auth, orderId)));
      tracked = [];

      for (const quote of buildLadder(mid, spec)) {
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
            tracked.push(result.order.orderId);
          }
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 400)) throw err;
        }
      }
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
    const stale = open.slice(0, 300);
    await Promise.allSettled(stale.map((order) => api.cancelOrder(auth, order.id)));
    if (stale.length > 0) log(tag, `cancelled ${stale.length} stale orders`);
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
    quotes.push({ side: "buy", price: bid, qty: sized(spec, depthBoost) });
    quotes.push({ side: "sell", price: ask, qty: sized(spec, depthBoost) });
  }
  return quotes;
}

function sized(spec: MarketSpec, boost: number) {
  return Math.max(spec.minQty, Math.round(randInt(spec.quoteSize[0], spec.quoteSize[1]) * boost));
}
