import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
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
  // coalesce diffs to one state update per animation frame to avoid a re-render per tick
  const pendingRef = useRef<DepthDiff[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!symbol) {
      bufferRef.current = [];
      pendingRef.current = [];
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      snapshotReadyRef.current = false;
      socketReadyRef.current = false;
      setState({ depth: null, status: "idle", error: null });
      return;
    }

    let cancelled = false;
    const activeSymbol = symbol;
    const channel = `market:${activeSymbol}:depth`;
    bufferRef.current = [];
    pendingRef.current = [];
    snapshotReadyRef.current = false;
    socketReadyRef.current = false;
    setState({ depth: null, status: "connecting", error: null });

    function flushPending() {
      rafRef.current = null;
      const diffs = pendingRef.current;
      pendingRef.current = [];
      if (diffs.length === 0) return;

      setState((current) => {
        if (!current.depth) return current;
        const nextDepth = diffs.reduce((depth, diff) => {
          if (diff.finalUpdateId <= depth.lastUpdateId) return depth;
          return applyDiff(depth, diff);
        }, current.depth);
        if (nextDepth === current.depth) return current;
        return { depth: nextDepth, status: "live", error: null };
      });
    }

    const subscription = subscribeChannel<DepthDiff>(channel, (diff) => {
      if (diff.symbol !== activeSymbol) return;
      if (!snapshotReadyRef.current) {
        bufferRef.current.push(diff);
        return;
      }

      pendingRef.current.push(diff);
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushPending);
      }
    }, {
      onOpen() {
        socketReadyRef.current = true;
        if (snapshotReadyRef.current) {
          setState((current) => ({ ...current, status: "live", error: null }));
        }
      },
      onClose() {
        socketReadyRef.current = false;
        if (cancelled) return;
        snapshotReadyRef.current = false;
        bufferRef.current = [];
        setState((current) => ({ ...current, status: current.depth ? "connecting" : current.status }));
        void loadSnapshot();
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
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [symbol]);

  return state;
}
