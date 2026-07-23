import { api, BotAuth } from "./api";
import { Env, MarketSpec } from "./config";
import { IndexFeed } from "./feed";
import { jitter, log, randInt, sleep } from "./util";
import { topUp } from "./quoter";

const CYCLE_MS = 4 * 60_000;
const BALANCE_FLOOR_CENTS = 10_000_000; // $100k
const TOPUP_CENTS = 100_000_000; // $1M

type OpenPosition = { side: "buy" | "sell"; qty: number };

/**
 * Opens max-leverage positions and lets the market decide: either the position
 * gets liquidated (exercising the liquidation engine and the notifications
 * channel end-to-end) or it gets closed a few cycles later.
 */
export function runDegen(auth: BotAuth, feed: IndexFeed, specs: MarketSpec[]) {
  const tag = "degen";
  const positions = new Map<string, OpenPosition>();

  listenForLiquidations(auth, (symbol) => {
    positions.delete(symbol);
    log(tag, `${symbol} position liquidated`);
  });

  void (async () => {
    while (true) {
      await sleep(jitter(CYCLE_MS, 0.5));
      try {
        await topUp(auth, tag, BALANCE_FLOOR_CENTS, TOPUP_CENTS);

        const spec = specs[randInt(0, specs.length - 1)]!;
        const open = positions.get(spec.symbol);

        if (open) {
          await api.placeOrder(auth, {
            orderType: "market",
            symbol: spec.symbol,
            side: open.side === "buy" ? "sell" : "buy",
            qty: open.qty,
            leverage: spec.maxLeverage,
            slippageBps: 300,
          });
          positions.delete(spec.symbol);
          log(tag, `closed ${spec.symbol} position`);
        } else {
          if (!feed.price(spec.symbol)) continue;
          const side = Math.random() < 0.5 ? "buy" : "sell";
          await api.placeOrder(auth, {
            orderType: "market",
            symbol: spec.symbol,
            side,
            qty: spec.minQty,
            leverage: spec.maxLeverage,
            slippageBps: 300,
          });
          positions.set(spec.symbol, { side, qty: spec.minQty });
          log(tag, `opened ${spec.maxLeverage}x ${side === "buy" ? "long" : "short"} on ${spec.symbol}`);
        }
      } catch (err) {
        log(tag, `cycle failed: ${(err as Error).message}`);
      }
    }
  })();
}

function listenForLiquidations(auth: BotAuth, onLiquidation: (symbol: string) => void) {
  const connect = () => {
    const ws = new WebSocket(Env.wsUrl);
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "SUBSCRIBE",
          channel: `user:${auth.userId}:notifications`,
          token: auth.token,
        }),
      );
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          channel?: string;
          data?: { type?: string; symbol?: string };
        };
        if (!msg.channel?.endsWith(":notifications")) return;
        if ((msg.data?.type === "liquidation" || msg.data?.type === "adl") && msg.data.symbol) {
          onLiquidation(msg.data.symbol);
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => setTimeout(connect, 3000);
    ws.onerror = () => ws.close();
  };
  connect();
}
