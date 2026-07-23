import { api, ApiError, BotAuth } from "./api";
import { MarketSpec } from "./config";
import { IndexFeed } from "./feed";
import { log, randInt, sleep } from "./util";
import { topUp } from "./quoter";

const BALANCE_FLOOR_CENTS = 200_000_000; // $2M
const TOPUP_CENTS = 5_000_000_000; // $50M

/**
 * Random order flow: crosses the spread at irregular intervals so the tape,
 * candles, and 24h stats reflect genuine matched trades.
 */
export async function runTaker(auth: BotAuth, feed: IndexFeed, spec: MarketSpec) {
  const tag = `taker:${spec.symbol}`;
  let loops = 0;

  while (true) {
    await sleep(1500 + Math.random() * 6500);
    try {
      if (!feed.price(spec.symbol)) continue;
      if (loops++ % 50 === 0) await topUp(auth, tag, BALANCE_FLOOR_CENTS, TOPUP_CENTS);

      await api.placeOrder(auth, {
        orderType: "market",
        symbol: spec.symbol,
        side: Math.random() < 0.5 ? "buy" : "sell",
        qty: sampleSize(spec),
        leverage: randInt(2, Math.min(8, spec.maxLeverage)),
        slippageBps: 300,
      });
    } catch (err) {
      // "no liquidity" while the quoter is mid-refresh is normal background noise
      if (!(err instanceof ApiError && err.status === 400)) {
        log(tag, `order failed: ${(err as Error).message}`);
      }
      await sleep(3000);
    }
  }
}

function sampleSize(spec: MarketSpec): number {
  const [min, max] = spec.takerSize;
  const roll = Math.random();
  if (roll < 0.6) return min;
  if (roll < 0.9) return Math.min(max, min * 2 + randInt(0, 2));
  return randInt(min, max); // occasional sweep
}
