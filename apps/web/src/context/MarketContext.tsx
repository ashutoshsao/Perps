import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Market, Ticker } from "../api/types";
import { useAsyncData } from "../hooks/useAsyncData";
import { useMarkPrice } from "../hooks/useMarkPrice";
import { useIndexPrice } from "../hooks/useIndexPrice";
import { useFundingRate } from "../hooks/useFundingRate";
import { fallbackMarkets } from "../lib/constants";
import { sortMarkets } from "../lib/markets";

type MarketContextValue = {
  markets: Market[];
  marketsLoading: boolean;
  marketsError: string | null;
  refreshMarkets: () => void;
  symbol: string;
  market: Market | null;
  setSymbol: (symbol: string) => void;
  ticker: Ticker | null;
  tickerLoading: boolean;
  markPrice: number | undefined;
  markPriceLive: boolean;
  indexPrice: number | undefined;
  fundingRate: number | null;
  fundingSettledAt: number | null;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [marketsRefreshKey, setMarketsRefreshKey] = useState(0);
  const refreshMarkets = () => setMarketsRefreshKey((k) => k + 1);
  const marketsState = useAsyncData(() => api.getMarkets(), [marketsRefreshKey]);
  const rawMarkets = marketsState.data?.markets ?? [];
  const markets = useMemo(
    () => sortMarkets(rawMarkets.length ? rawMarkets : fallbackMarkets),
    [rawMarkets],
  );

  const [symbol, setSymbol] = useState("");

  useEffect(() => {
    if (markets.length > 0 && !markets.some((m) => m.symbol === symbol)) {
      setSymbol(markets[0]!.symbol);
    }
  }, [markets, symbol]);

  const market = useMemo(() => markets.find((m) => m.symbol === symbol) ?? null, [markets, symbol]);

  const tickerState = useAsyncData(
    () => (symbol ? api.getTicker(symbol) : Promise.resolve(null)),
    [symbol],
  );
  const markPriceState = useMarkPrice(symbol || null);
  const indexPriceState = useIndexPrice(symbol || null);
  const fundingRateState = useFundingRate(symbol || null);

  return (
    <MarketContext.Provider
      value={{
        markets,
        marketsLoading: marketsState.isLoading,
        marketsError: marketsState.error,
        refreshMarkets,
        symbol,
        market,
        setSymbol,
        ticker: tickerState.data,
        tickerLoading: tickerState.isLoading,
        markPrice: markPriceState.data?.price,
        markPriceLive: markPriceState.isLive,
        indexPrice: indexPriceState.data?.price,
        fundingRate: fundingRateState.data?.rate ?? null,
        fundingSettledAt: fundingRateState.data?.settledAt ?? null,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within MarketProvider");
  return ctx;
}
