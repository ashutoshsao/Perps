import { useEffect, useState } from "react";
import type { IndexPrice } from "../api/types";
import { subscribeChannel } from "../ws/client";

type IndexPriceState = {
  data: IndexPrice | null;
  error: string | null;
  isLive: boolean;
};

export function useIndexPrice(symbol: string | null): IndexPriceState {
  const [state, setState] = useState<IndexPriceState>({ data: null, error: null, isLive: false });

  useEffect(() => {
    if (!symbol) {
      setState({ data: null, error: null, isLive: false });
      return;
    }

    const subscription = subscribeChannel<IndexPrice>(`market:${symbol}:index`, (data) => {
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
