import { useEffect, useState } from "react";

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

export function useAsyncData<T>(loader: () => Promise<T>, dependencies: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    setState((current) => ({ ...current, error: null, isLoading: true }));

    loader()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, isLoading: false });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : "Request failed",
            isLoading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return state;
}
