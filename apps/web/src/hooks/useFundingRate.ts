import { useEffect, useState } from "react";
import type { FundingUpdate } from "../api/types";
import { subscribeChannel } from "../ws/client";
import { api } from "../api/client";
import { useAsyncData } from "./useAsyncData";

type FundingRateState = {
  data: FundingUpdate | null;
  error: string | null;
  isLive: boolean;
  nextSettlementAt: number | null;
};

const POLL_INTERVAL_MS = 60_000;

export function useFundingRate(symbol: string | null): FundingRateState {
  const [live, setLive] = useState<{ data: FundingUpdate | null; error: string | null; isLive: boolean }>({
    data: null,
    error: null,
    isLive: false,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // funding settles infrequently — always reset so a stale rate from the
    // previous market never shows against the newly selected one
    setLive({ data: null, error: null, isLive: false });
    if (!symbol) return;

    const subscription = subscribeChannel<FundingUpdate>(`market:${symbol}:funding`, (data) => {
      if (data.symbol !== symbol) return;
      setLive({ data, error: null, isLive: true });
    }, {
      onOpen() {
        setLive((current) => ({ ...current, error: null }));
      },
      onClose() {
        setLive((current) => ({ ...current, isLive: false }));
      },
      onError(message) {
        setLive((current) => ({ ...current, error: message, isLive: false }));
      },
    });

    return () => subscription.unsubscribe();
  }, [symbol]);

  useEffect(() => {
    setTick(0);
    if (!symbol) return;
    const interval = setInterval(() => setTick((t) => t + 1), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [symbol]);

  const predicted = useAsyncData(
    () => (symbol ? api.getFundingInfo(symbol) : Promise.resolve(null)),
    [symbol, tick],
  );

  // a settled WS event always wins once it lands; until then, show the predicted rate
  const fallback: FundingUpdate | null = predicted.data
    ? {
        symbol: predicted.data.symbol,
        rate: predicted.data.rate,
        settledAt: predicted.data.lastSettled?.settledAt ?? predicted.data.updatedAt ?? 0,
      }
    : null;

  return {
    data: live.data ?? fallback,
    error: live.error,
    isLive: live.isLive,
    nextSettlementAt: predicted.data?.nextSettlementAt ?? null,
  };
}
