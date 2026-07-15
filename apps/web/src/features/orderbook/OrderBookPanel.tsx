import { useMemo, useState } from "react";
import { TextTabs } from "../../components/ui/Tabs";
import { DepthBuyIcon, DepthFullIcon, DepthSplitIcon, LockIcon, MinusIcon, PlusIcon } from "../../icons";
import { useTrading } from "../../context/TradingContext";
import { useTicket } from "../../context/TicketContext";
import { formatNumber, formatTime } from "../../lib/format";

const GROUPINGS = [1, 10, 100, 1000];
const ROWS = 8;
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

function Row({
  price,
  qty,
  total,
  depth,
  side,
  onClick,
}: {
  price: number;
  qty: number;
  total: number;
  depth: number;
  side: "ask" | "bid";
  onClick: () => void;
}) {
  const color = side === "ask" ? "text-red" : "text-green";
  const barColor = side === "ask" ? "bg-red-dim" : "bg-green-dim";

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative grid w-full grid-cols-3 px-3 py-[3px] text-left text-[12px] hover:bg-surface"
    >
      <div className={`absolute inset-y-0 right-0 ${barColor}`} style={{ width: `${depth}%` }} />
      <span className={`relative z-10 ${color}`}>{formatNumber(price)}</span>
      <span className="relative z-10 text-right text-text">{formatNumber(qty)}</span>
      <span className="relative z-10 text-right text-text-muted">{formatNumber(total)}</span>
    </button>
  );
}

export function OrderBookPanel() {
  const [tab, setTab] = useState("Book");
  const [groupIdx, setGroupIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [locked, setLocked] = useState(false);
  const { setPrice } = useTicket();
  const { depth, depthStatus, depthError, trades, tradesLoading, tradesError } = useTrading();

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

  return (
    <div className="flex w-[300px] shrink-0 flex-col border-r border-border-soft">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-soft px-4">
        <TextTabs items={["Book", "Trades"]} active={tab} onChange={setTab} />
      </div>

      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border-soft px-3">
        <div className="flex items-center gap-3 text-text-muted">
          <button type="button" onClick={() => setViewMode("full")} className={viewMode === "full" ? "text-blue" : "hover:text-text"}>
            <DepthFullIcon />
          </button>
          <button type="button" onClick={() => setViewMode("split")} className={viewMode === "split" ? "text-blue" : "hover:text-text"}>
            <DepthSplitIcon />
          </button>
          <button type="button" onClick={() => setViewMode("buy")} className={viewMode === "buy" ? "text-blue" : "hover:text-text"}>
            <DepthBuyIcon />
          </button>
          <button type="button" onClick={() => setLocked((v) => !v)} className={locked ? "text-blue" : "hover:text-text"}>
            <LockIcon />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGroupIdx((i) => (i - 1 + GROUPINGS.length) % GROUPINGS.length)}
            className="text-text-muted hover:text-text"
          >
            <MinusIcon />
          </button>
          <span className="text-[12px] text-text">{step}</span>
          <button
            type="button"
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
          <>
            <div className="grid grid-cols-3 px-3 py-1.5 text-[11px] font-medium text-text-dim">
              <span>Price</span>
              <span className="text-right">Size</span>
              <span className="text-right">Total</span>
            </div>

            <div className="flex flex-col">
              {visibleAsks.map((a) => (
                <Row
                  key={a.price}
                  side="ask"
                  price={a.price}
                  qty={a.qty}
                  total={a.total}
                  depth={(a.total / maxTotal) * 100}
                  onClick={() => setPrice(String(Math.round(a.price)))}
                />
              ))}
            </div>

            <div className="flex items-baseline gap-2 px-3 py-1.5 text-[16px] font-bold">
              <span className="text-green">{bids[0] ? formatNumber(bids[0].price) : "-"}</span>
              <span className="text-red">{asks[asks.length - 1] ? formatNumber(asks[asks.length - 1]!.price) : "-"}</span>
            </div>

            <div className="flex flex-col">
              {bids.map((b) => (
                <Row
                  key={b.price}
                  side="bid"
                  price={b.price}
                  qty={b.qty}
                  total={b.total}
                  depth={(b.total / maxTotal) * 100}
                  onClick={() => setPrice(String(Math.round(b.price)))}
                />
              ))}
            </div>

            <div className="mt-auto flex h-6 shrink-0 text-[11px] font-semibold">
              <div className="flex items-center bg-green pl-2 text-black/80" style={{ width: `${buyRatio}%` }}>
                {buyRatio}%
              </div>
              <div className="flex flex-1 items-center justify-end bg-red pr-2 text-white">{sellRatio}%</div>
            </div>
          </>
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
              {trades.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrice(String(Math.round(Number(t.price))))}
                  className="grid grid-cols-3 px-3 py-[3px] text-left text-[12px] hover:bg-surface"
                >
                  <span className={t.side === "buy" ? "text-green" : "text-red"}>{formatNumber(t.price)}</span>
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
