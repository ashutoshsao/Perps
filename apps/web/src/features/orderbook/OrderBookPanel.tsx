import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TextTabs } from "../../components/ui/Tabs";
import { DepthBuyIcon, DepthFullIcon, DepthSplitIcon, LockIcon, MinusIcon, PlusIcon } from "../../icons";
import { useTrading } from "../../context/TradingContext";
import { useTicket } from "../../context/TicketContext";
import { useMarket } from "../../context/MarketContext";
import { formatNumber, formatTime, formatUsd, usd } from "../../lib/format";

// aggregation steps in cents: $0.01, $0.10, $1, $10, $100
const GROUPINGS = [1, 10, 100, 1000, 10000];
// cap per side — generous enough that both sides scroll independently instead of clipping
const ROWS = 40;
type ViewMode = "full" | "split" | "buy";

function aggregate(levels: [number, number][], step: number, direction: "up" | "down") {
  const buckets = new Map<number, number>();
  for (const [price, qty] of levels) {
    const bucket = direction === "up" ? Math.ceil(price / step) * step : Math.floor(price / step) * step;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + qty);
  }
  const entries = Array.from(buckets.entries());
  entries.sort((a, b) => (direction === "up" ? a[0] - b[0] : b[0] - a[0]));
  return entries;
}

function withTotals(entries: [number, number][]) {
  let cumulative = 0;
  const rows = entries.map(([price, qty]) => {
    cumulative += qty;
    return { price, qty, total: cumulative };
  });
  return { rows, maxTotal: cumulative };
}

const BAR_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

function Row({
  price,
  qty,
  total,
  depth,
  ownDepth,
  side,
  onClick,
}: {
  price: number;
  qty: number;
  total: number;
  depth: number;
  ownDepth: number;
  side: "ask" | "bid";
  onClick: () => void;
}) {
  const color = side === "ask" ? "text-red" : "text-green";
  const barColor = side === "ask" ? "bg-red-dim" : "bg-green-dim";
  const ownBarColor = side === "ask" ? "bg-red/25" : "bg-green/25";

  return (
    <motion.button
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ layout: BAR_TRANSITION, opacity: { duration: 0.15 } }}
      type="button"
      onClick={onClick}
      className="relative grid w-full grid-cols-3 px-3 py-[3px] text-left text-[12px] hover:bg-surface"
    >
      <motion.div
        className={`absolute inset-y-0 right-0 ${barColor}`}
        initial={false}
        animate={{ width: `${depth}%` }}
        transition={BAR_TRANSITION}
      />
      <motion.div
        className={`absolute inset-y-0 right-0 ${ownBarColor}`}
        initial={false}
        animate={{ width: `${ownDepth}%` }}
        transition={BAR_TRANSITION}
      />
      <span className={`relative z-10 ${color}`}>{formatUsd(price)}</span>
      <span className="relative z-10 text-right text-text">{formatNumber(qty)}</span>
      <span className="relative z-10 text-right text-text-muted">{formatNumber(total)}</span>
    </motion.button>
  );
}

export function OrderBookPanel({
  variant = "desktop",
  tab: controlledTab,
  onTabChange,
  hideTabs = false,
}: {
  variant?: "desktop" | "mobile";
  tab?: string;
  onTabChange?: (tab: string) => void;
  hideTabs?: boolean;
} = {}) {
  const [internalTab, setInternalTab] = useState("Book");
  const tab = controlledTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;
  const [groupIdx, setGroupIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [locked, setLocked] = useState(false);
  const { setPrice } = useTicket();
  const { depth, depthStatus, depthError, trades, tradesLoading, tradesError } = useTrading();
  const { symbol, markPrice } = useMarket();

  const midRowRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const centeredRef = useRef(false);
  // track the mid row's viewport position ourselves and correct scrollTop to hold it,
  // since native overflow-anchor doesn't anchor to a specific row
  const anchorTopRef = useRef<number | null>(null);
  // detect user scroll intent from input events directly — scrollTop write events are
  // racy and can get misread as user scrolls during a correction burst
  const userInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<number | null>(null);

  // re-center once per symbol on first real depth, never on a routine tick
  useEffect(() => {
    centeredRef.current = false;
    anchorTopRef.current = null;
  }, [symbol]);

  useEffect(() => {
    if (!depth || centeredRef.current) return;
    centeredRef.current = true;
    const id = requestAnimationFrame(() => {
      midRowRef.current?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [depth]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function onUserInput() {
      userInteractingRef.current = true;
      if (interactionTimeoutRef.current != null) window.clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = window.setTimeout(() => {
        userInteractingRef.current = false;
        anchorTopRef.current = midRowRef.current?.getBoundingClientRect().top ?? null;
      }, 150);
    }
    el.addEventListener("wheel", onUserInput, { passive: true });
    el.addEventListener("touchmove", onUserInput, { passive: true });
    return () => {
      el.removeEventListener("wheel", onUserInput);
      el.removeEventListener("touchmove", onUserInput);
      if (interactionTimeoutRef.current != null) window.clearTimeout(interactionTimeoutRef.current);
    };
  }, []);

  const correctionTimeoutRef = useRef<number | null>(null);

  const step = GROUPINGS[groupIdx]!;

  const { asks, bids, maxTotal, buyRatio, sellRatio } = useMemo(() => {
    if (!depth) return { asks: [], bids: [], maxTotal: 0, buyRatio: 50, sellRatio: 50 };

    const askEntries = aggregate(depth.asks, step, "up").slice(0, ROWS);
    const bidEntries = aggregate(depth.bids, step, "down").slice(0, ROWS);
    const askTotals = withTotals(askEntries);
    const bidTotals = withTotals(bidEntries);
    const maxTotal = Math.max(askTotals.maxTotal, bidTotals.maxTotal, 1);
    const totalQty = askTotals.maxTotal + bidTotals.maxTotal;
    const buyRatio = totalQty > 0 ? Math.round((bidTotals.maxTotal / totalQty) * 100) : 50;

    return {
      asks: [...askTotals.rows].reverse(),
      bids: bidTotals.rows,
      maxTotal,
      buyRatio,
      sellRatio: 100 - buyRatio,
    };
  }, [depth, step]);

  const isLoading = depthStatus === "idle" || depthStatus === "connecting" || depthStatus === "snapshot";
  const visibleAsks = viewMode === "buy" ? [] : asks;
  const lastTrade = trades[0];

  // correct right after React applies row changes, and again ~180ms later to catch
  // AnimatePresence removing an exited row's DOM node after its fade-out
  useLayoutEffect(() => {
    function correctScroll() {
      if (userInteractingRef.current) return;
      const scrollEl = scrollContainerRef.current;
      const midEl = midRowRef.current;
      if (!scrollEl || !midEl) return;
      const currentTop = midEl.getBoundingClientRect().top;
      if (anchorTopRef.current == null) {
        anchorTopRef.current = currentTop;
        return;
      }
      const delta = currentTop - anchorTopRef.current;
      if (delta !== 0) scrollEl.scrollTop += delta;
    }

    correctScroll();
    if (correctionTimeoutRef.current != null) window.clearTimeout(correctionTimeoutRef.current);
    correctionTimeoutRef.current = window.setTimeout(correctScroll, 180);
    return () => {
      if (correctionTimeoutRef.current != null) window.clearTimeout(correctionTimeoutRef.current);
    };
  }, [asks, bids]);

  const rootClass =
    variant === "mobile"
      ? "flex h-full w-full flex-col bg-panel"
      : "flex w-[300px] shrink-0 flex-col border-r border-border-soft bg-panel";

  return (
    <div className={rootClass}>
      {!hideTabs && (
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-soft px-4">
          <TextTabs items={["Book", "Trades"]} active={tab} onChange={setTab} />
        </div>
      )}

      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border-soft px-3">
        <div className="flex items-center gap-3 text-text-muted">
          <button type="button" title="Bids and asks" onClick={() => setViewMode("full")} className={viewMode === "full" ? "text-blue" : "hover:text-text"}>
            <DepthFullIcon />
          </button>
          <button type="button" title="Split view" onClick={() => setViewMode("split")} className={viewMode === "split" ? "text-blue" : "hover:text-text"}>
            <DepthSplitIcon />
          </button>
          <button type="button" title="Bids only" onClick={() => setViewMode("buy")} className={viewMode === "buy" ? "text-blue" : "hover:text-text"}>
            <DepthBuyIcon />
          </button>
          <button type="button" title={locked ? "Unlock price scrolling" : "Lock price scrolling"} onClick={() => setLocked((v) => !v)} className={locked ? "text-blue" : "hover:text-text"}>
            <LockIcon />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Widen price grouping"
            onClick={() => setGroupIdx((i) => (i - 1 + GROUPINGS.length) % GROUPINGS.length)}
            className="text-text-muted hover:text-text"
          >
            <MinusIcon />
          </button>
          <span title="Price grouping" className="cursor-default text-[12px] text-text">{formatNumber(step / 100)}</span>
          <button
            type="button"
            title="Narrow price grouping"
            onClick={() => setGroupIdx((i) => (i + 1) % GROUPINGS.length)}
            className="text-text-muted hover:text-text"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {tab === "Book" ? (
        isLoading && !depth ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">Loading order book...</div>
        ) : depthError && !depth ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-[13px] text-red">
            Depth unavailable: {depthError}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid shrink-0 grid-cols-3 px-3 py-1.5 text-[11px] font-medium text-text-dim">
              <span>Price</span>
              <span className="text-right">Size</span>
              <span className="text-right">Total</span>
            </div>

            <div
              ref={scrollContainerRef}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
              style={{ overflowAnchor: "none" }}
            >
              <AnimatePresence initial={false}>
                {visibleAsks.map((a) => (
                  <Row
                    key={a.price}
                    side="ask"
                    price={a.price}
                    qty={a.qty}
                    total={a.total}
                    depth={(a.total / maxTotal) * 100}
                    ownDepth={(a.qty / maxTotal) * 100}
                    onClick={() => setPrice(String(usd(a.price)))}
                  />
                ))}
              </AnimatePresence>

              <div ref={midRowRef} className="flex shrink-0 items-baseline gap-2 px-3 py-1.5">
                <span
                  title="Last traded price"
                  className={`cursor-default text-[16px] font-bold ${lastTrade ? (lastTrade.side === "buy" ? "text-green" : "text-red") : "text-text"}`}
                >
                  {lastTrade ? formatUsd(lastTrade.price) : "-"}
                </span>
                <span title="Mark price" className="cursor-default text-[13px] font-medium text-text-dim">
                  {typeof markPrice === "number" ? formatUsd(markPrice) : "-"}
                </span>
              </div>

              <AnimatePresence initial={false}>
                {bids.map((b) => (
                  <Row
                    key={b.price}
                    side="bid"
                    price={b.price}
                    qty={b.qty}
                    total={b.total}
                    depth={(b.total / maxTotal) * 100}
                    ownDepth={(b.qty / maxTotal) * 100}
                    onClick={() => setPrice(String(usd(b.price)))}
                  />
                ))}
              </AnimatePresence>
            </div>

            <div className="flex h-6 shrink-0 text-[11px] font-semibold">
              <motion.div
                className="flex items-center bg-green pl-2 text-black/80"
                initial={false}
                animate={{ width: `${buyRatio}%` }}
                transition={BAR_TRANSITION}
              >
                {buyRatio}%
              </motion.div>
              <div className="flex flex-1 items-center justify-end bg-red pr-2 text-white">{sellRatio}%</div>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-3 px-3 py-1.5 text-[11px] font-medium text-text-dim">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>
          {tradesLoading && trades.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">Loading trades...</div>
          ) : tradesError && trades.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-[13px] text-red">
              Trades unavailable: {tradesError}
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-y-auto">
              {trades.map((t) => (
                <button
                  key={`${t.time}-${t.price}-${t.qty}-${t.side}`}
                  type="button"
                  onClick={() => setPrice(String(usd(t.price)))}
                  className="grid grid-cols-3 px-3 py-[3px] text-left text-[12px] hover:bg-surface"
                >
                  <span className={t.side === "buy" ? "text-green" : "text-red"}>{formatUsd(t.price)}</span>
                  <span className="text-right text-text">{formatNumber(t.qty)}</span>
                  <span className="text-right text-text-muted">{formatTime(t.time)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
