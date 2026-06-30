import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { normalizeMarketSymbol } from "../api/symbols";
import type { Depth, DepthDiff } from "../api/types";
import { subscribeChannel } from "../ws/client";

type DepthStatus = "idle" | "connecting" | "snapshot" | "live" | "error";

type DepthSyncState = {
  depth: Depth | null;
  status: DepthStatus;
  error: string | null;
};

const BOOK_LIMIT = 20;

function upsertLevel(levels: [number, number][], [price, qty]: [number, number]) {
  const index = levels.findIndex(([levelPrice]) => levelPrice === price);
  if (qty <= 0) {
    if (index >= 0) levels.splice(index, 1);
    return;
  }

  if (index >= 0) {
    levels[index] = [price, qty];
  } else {
    levels.push([price, qty]);
  }
}

function applyDiff(depth: Depth, diff: DepthDiff): Depth {
  const bids = [...depth.bids];
  const asks = [...depth.asks];

  diff.bids.forEach((level) => upsertLevel(bids, level));
  diff.asks.forEach((level) => upsertLevel(asks, level));

  bids.sort(([a], [b]) => b - a);
  asks.sort(([a], [b]) => a - b);

  return {
    symbol: depth.symbol,
    lastUpdateId: diff.finalUpdateId,
    bids: bids.slice(0, BOOK_LIMIT),
    asks: asks.slice(0, BOOK_LIMIT),
  };
}

export function useDepthSync(symbol: string | null): DepthSyncState {
  const [state, setState] = useState<DepthSyncState>({ depth: null, status: "idle", error: null });
  const bufferRef = useRef<DepthDiff[]>([]);
  const snapshotReadyRef = useRef(false);
  const socketReadyRef = useRef(false);

  useEffect(() => {
    if (!symbol) {
      bufferRef.current = [];
      snapshotReadyRef.current = false;
      socketReadyRef.current = false;
      setState({ depth: null, status: "idle", error: null });
      return;
    }

    let cancelled = false;
    const activeSymbol = normalizeMarketSymbol(symbol);
    const channel = `market:${activeSymbol}:depth`;
    bufferRef.current = [];
    snapshotReadyRef.current = false;
    socketReadyRef.current = false;
    setState({ depth: null, status: "connecting", error: null });

    const subscription = subscribeChannel<DepthDiff>(channel, (diff) => {
      if (normalizeMarketSymbol(diff.symbol) !== activeSymbol) return;
      if (!snapshotReadyRef.current) {
        bufferRef.current.push(diff);
        return;
      }

      setState((current) => {
        if (!current.depth || diff.finalUpdateId <= current.depth.lastUpdateId) return current;
        const nextDepth = applyDiff(current.depth, diff);
        return { depth: nextDepth, status: "live", error: null };
      });
    }, {
      onOpen() {
        socketReadyRef.current = true;
        if (snapshotReadyRef.current) {
          setState((current) => ({ ...current, status: "live", error: null }));
        }
      },
      onClose() {
        socketReadyRef.current = false;
        setState((current) => ({ ...current, status: current.depth ? "connecting" : current.status }));
      },
      onError(message) {
        setState((current) => ({ ...current, status: "error", error: message }));
      },
    });

    async function loadSnapshot() {
      try {
        setState((current) => ({ ...current, status: "snapshot", error: null }));
        const snapshot = await api.getDepth(activeSymbol);
        if (cancelled) return;

        const replayableDiffs = bufferRef.current
          .filter((diff) => diff.finalUpdateId > snapshot.lastUpdateId)
          .sort((a, b) => a.finalUpdateId - b.finalUpdateId);
        const depth = replayableDiffs.reduce(applyDiff, snapshot);

        bufferRef.current = [];
        snapshotReadyRef.current = true;
        setState({ depth, status: socketReadyRef.current ? "live" : "connecting", error: null });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load depth";
        setState({ depth: null, status: "error", error: message });
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [symbol]);

  return state;
}
