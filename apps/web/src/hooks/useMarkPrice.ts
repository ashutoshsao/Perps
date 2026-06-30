import { useEffect, useState } from "react";
import type { MarkPrice } from "../api/types";
import { subscribeChannel } from "../ws/client";

type MarkPriceState = {
  data: MarkPrice | null;
  error: string | null;
  isLive: boolean;
};

export function useMarkPrice(symbol: string | null): MarkPriceState {
  const [state, setState] = useState<MarkPriceState>({ data: null, error: null, isLive: false });

  useEffect(() => {
    if (!symbol) {
      setState({ data: null, error: null, isLive: false });
      return;
    }

    const subscription = subscribeChannel<MarkPrice>(`market:${symbol}:markPrice`, (data) => {
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
