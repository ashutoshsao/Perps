import { createContext, useContext, useState, type ReactNode } from "react";
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

  const tradesState = useAsyncData(
    () => (symbol ? api.getTrades(symbol) : Promise.resolve({ trades: [] })),
    [symbol],
  );
  const liveTrades = useLiveTrades(symbol || null, tradesState.data?.trades ?? []);

  const klinesState = useAsyncData(
    () => (symbol ? api.getKlines(symbol, chartInterval) : Promise.resolve({ candles: [] })),
    [symbol, chartInterval],
  );
  const candles = useLiveCandles(klinesState.data?.candles ?? [], liveTrades.liveTrades, chartInterval);

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
