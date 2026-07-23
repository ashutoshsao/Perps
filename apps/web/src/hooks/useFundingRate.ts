import { useEffect, useState } from "react";
import type { FundingUpdate } from "../api/types";
import { subscribeChannel } from "../ws/client";

type FundingRateState = {
  data: FundingUpdate | null;
  error: string | null;
  isLive: boolean;
};

export function useFundingRate(symbol: string | null): FundingRateState {
  const [state, setState] = useState<FundingRateState>({ data: null, error: null, isLive: false });

  useEffect(() => {
    // funding settles infrequently — always reset so a stale rate from the
    // previous market never shows against the newly selected one
    setState({ data: null, error: null, isLive: false });
    if (!symbol) return;

    const subscription = subscribeChannel<FundingUpdate>(`market:${symbol}:funding`, (data) => {
      if (data.symbol !== symbol) return;
      setState({ data, error: null, isLive: true });
    }, {
      onOpen() {
        setState((current) => ({ ...current, error: null }));
      },
      onClose() {
        setState((current) => ({ ...current, isLive: false }));
      },
      onError(message) {
        setState((current) => ({ ...current, error: message, isLive: false }));
      },
    });

    return () => subscription.unsubscribe();
  }, [symbol]);

  return state;
}
