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

function mergeTrades(liveTrades: Trade[], snapshotTrades: Trade[], cap?: number) {
  const seen = new Set<string>();
  const merged: Trade[] = [];

  for (const trade of [...liveTrades, ...snapshotTrades]) {
    const key = tradeKey(trade);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trade);
    if (cap != null && merged.length >= cap) break;
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
      // uncapped — useLiveCandles rebuilds the whole candle series from this array on
      // every change, so capping it here silently drops older candle buckets once trade
      // volume exceeds the cap. Only the rendered trade list below needs a display cap.
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

  const trades = useMemo(() => mergeTrades(liveTrades, snapshotTrades, MAX_TRADES), [liveTrades, snapshotTrades]);

  return { trades, liveTrades, isLive, error };
}
