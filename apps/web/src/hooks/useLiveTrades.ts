import { useEffect, useMemo, useState } from "react";
import type { Trade, TradeUpdate } from "../api/types";
import { subscribeChannel } from "../ws/client";

const MAX_TRADES = 80;

function toTrade(update: TradeUpdate): Trade {
  return {
    time: new Date(update.createdAt).toISOString(),
    symbol: update.symbol,
    price: update.price,
    qty: update.qty,
    side: update.side,
  };
}

function tradeKey(trade: Trade) {
  return `${trade.time}:${trade.symbol}:${trade.price}:${trade.qty}:${trade.side}`;
}

function mergeTrades(liveTrades: Trade[], snapshotTrades: Trade[]) {
  const seen = new Set<string>();
  const merged: Trade[] = [];

  for (const trade of [...liveTrades, ...snapshotTrades]) {
    const key = tradeKey(trade);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trade);
    if (merged.length >= MAX_TRADES) break;
  }

  return merged;
}

export function useLiveTrades(symbol: string | null, snapshotTrades: Trade[]) {
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLiveTrades([]);
    setIsLive(false);
    setError(null);

    if (!symbol) return;

    const subscription = subscribeChannel<TradeUpdate>(`market:${symbol}:trade`, (update) => {
      if (update.symbol !== symbol) return;
      const trade = toTrade(update);
      setLiveTrades((current) => mergeTrades([trade, ...current], []));
    }, {
      onOpen() {
        setIsLive(true);
        setError(null);
      },
      onClose() {
        setIsLive(false);
      },
      onError(message) {
        setError(message);
        setIsLive(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [symbol]);

  const trades = useMemo(() => mergeTrades(liveTrades, snapshotTrades), [liveTrades, snapshotTrades]);

  return { trades, liveTrades, isLive, error };
}
