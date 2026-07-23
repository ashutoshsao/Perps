import { Env } from "./config";
import { log } from "./util";

const STALE_MS = 30_000;

/** Caches the latest index price (integer cents) per market from the wss gateway. */
export class IndexFeed {
  private prices = new Map<string, { price: number; at: number }>();

  constructor(private symbols: string[]) {}

  start() {
    this.connect();
  }

  private connect() {
    const ws = new WebSocket(Env.wsUrl);

    ws.onopen = () => {
      log("feed", `connected to ${Env.wsUrl}`);
      for (const symbol of this.symbols) {
        ws.send(JSON.stringify({ type: "SUBSCRIBE", channel: `market:${symbol}:index` }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          channel?: string;
          data?: { symbol?: string; price?: number };
        };
        if (!msg.channel?.endsWith(":index")) return;
        if (typeof msg.data?.price !== "number" || !msg.data.symbol) return;
        this.prices.set(msg.data.symbol, { price: msg.data.price, at: Date.now() });
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      setTimeout(() => this.connect(), 2000);
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  /** Latest index price in cents, or null when the feed is stale. */
  price(symbol: string): number | null {
    const tick = this.prices.get(symbol);
    if (!tick || Date.now() - tick.at > STALE_MS) return null;
    return tick.price;
  }
}
