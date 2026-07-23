import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Market } from "../api/types";
import { usd } from "../lib/format";

export type Mover = {
  symbol: string;
  price: string;
  pct: string;
  positive: boolean;
  changePct: number;
};

const REFRESH_MS = 20_000;

export function useMarketMovers(markets: Market[]) {
  const [movers, setMovers] = useState<Mover[]>([]);

  const symbolsKey = markets.map((m) => m.symbol).join(",");

  useEffect(() => {
    if (!symbolsKey) return;
    let cancelled = false;

    async function load() {
      const symbols = symbolsKey.split(",");
      const results = await Promise.allSettled(symbols.map((symbol) => api.getTicker(symbol)));
      if (cancelled) return;

      const next: Mover[] = [];
      results.forEach((result, i) => {
        if (result.status !== "fulfilled") return;
        const ticker = result.value;
        const changePct = Number(ticker.changePct);
        if (!Number.isFinite(changePct)) return;
        next.push({
          symbol: symbols[i]!,
          price: `$${usd(ticker.close).toLocaleString()}`,
          pct: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
          positive: changePct >= 0,
          changePct,
        });
      });

      next.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
      setMovers(next);
    }

    void load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [symbolsKey]);

  return movers;
}
