import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useAsyncData } from "../hooks/useAsyncData";
import { useDepthSync } from "../hooks/useDepthSync";
import { useLiveCandles, type ChartInterval } from "../hooks/useLiveCandles";
import { useLiveTrades } from "../hooks/useLiveTrades";
import { useMarket } from "./MarketContext";
import type { Candle, Depth, Trade } from "../api/types";

type TradingContextValue = {
  depth: Depth | null;
  depthStatus: "idle" | "connecting" | "snapshot" | "live" | "error";
  depthError: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  trades: Trade[];
  tradesLive: boolean;
  tradesError: string | null;
  tradesLoading: boolean;
  candles: Candle[];
  candlesLoading: boolean;
  candlesError: string | null;
  chartInterval: ChartInterval;
  setChartInterval: (interval: ChartInterval) => void;
};

const TradingContext = createContext<TradingContextValue | null>(null);

export function TradingProvider({ children }: { children: ReactNode }) {
  const { symbol } = useMarket();
  const [chartInterval, setChartInterval] = useState<ChartInterval>("1m");

  const depthSync = useDepthSync(symbol || null);
  const bestBid = depthSync.depth?.bids[0]?.[0] ?? null;
  const bestAsk = depthSync.depth?.asks[0]?.[0] ?? null;

  // a backgrounded tab can throttle timers enough that the WS misses trades outright
  // (not just delays them) — the live-trade merge has nothing to backfill from in that
  // case, so re-pull the REST snapshot whenever the tab regains focus to close the gap
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") setRefreshTick((t) => t + 1);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Candle/trade objects don't carry a symbol field, and useAsyncData deliberately keeps
  // showing the previous fetch's data while a new one is in flight (desirable for e.g. an
  // interval switch or the visibility refetch above, which refetch the *same* symbol). But
  // that means right after switching markets, the live trade feed (which resets and starts
  // receiving the new symbol's trades immediately) can get merged against the *old* symbol's
  // still-in-flight REST snapshot, producing candles that mix both markets' prices. Tag each
  // fetch with the symbol it was actually for so a mismatch can be treated as "not loaded yet"
  // instead of merged.
  const tradesState = useAsyncData(
    () => (symbol ? api.getTrades(symbol).then((r) => ({ ...r, symbol })) : Promise.resolve({ trades: [], symbol })),
    [symbol, refreshTick],
  );
  const tradesForSymbol = tradesState.data?.symbol === symbol ? tradesState.data?.trades ?? [] : [];
  const liveTrades = useLiveTrades(symbol || null, tradesForSymbol);

  const klinesState = useAsyncData(
    () => (symbol ? api.getKlines(symbol, chartInterval).then((r) => ({ ...r, symbol })) : Promise.resolve({ candles: [], symbol })),
    [symbol, chartInterval, refreshTick],
  );
  const candlesForSymbol = klinesState.data?.symbol === symbol ? klinesState.data?.candles ?? [] : [];
  const candles = useLiveCandles(candlesForSymbol, liveTrades.liveTrades, chartInterval);

  return (
    <TradingContext.Provider
      value={{
        depth: depthSync.depth,
        depthStatus: depthSync.status,
        depthError: depthSync.error,
        bestBid,
        bestAsk,
        trades: liveTrades.trades,
        tradesLive: liveTrades.isLive,
        tradesError: liveTrades.error,
        tradesLoading: tradesState.isLoading,
        candles,
        candlesLoading: klinesState.isLoading,
        candlesError: klinesState.error,
        chartInterval,
        setChartInterval,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error("useTrading must be used within TradingProvider");
  return ctx;
}
