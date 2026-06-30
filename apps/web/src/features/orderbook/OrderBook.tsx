import type { Depth } from "../../api/types";
import { formatNumber } from "../../lib/format";
import { PanelState } from "../../components/ui";

export function OrderBook({ depth, isLoading, error }: { depth: Depth | null; isLoading: boolean; error: string | null }) {
  const asks = depth?.asks ?? [];
  const bids = depth?.bids ?? [];
  const bestAsk = asks[0]?.[0] ?? null;
  const bestBid = bids[0]?.[0] ?? null;
  const mid = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : bestAsk ?? bestBid;
  const askRows = buildBookRows(asks.slice(0, 10), "ask").reverse();
  const bidRows = buildBookRows(bids.slice(0, 10), "bid");
  const maxCumulative = Math.max(...askRows.map((row) => row.cumulativeSize), ...bidRows.map((row) => row.cumulativeSize), 1);
  const maxLevelSize = Math.max(...askRows.map((row) => row.size), ...bidRows.map((row) => row.size), 1);

  if (isLoading) return <PanelState message="Loading depth" />;
  if (error) return <PanelState message={`Depth unavailable: ${error}`} />;
  if (asks.length === 0 && bids.length === 0) return <PanelState message="No depth available" />;

  return (
    <div className="flex h-full min-h-0 flex-col p-3 font-mono text-xs">
      <BookHeader />
      <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-hidden">
        {askRows.map((row) => (
          <BookRow key={`ask-${row.price}`} row={row} maxCumulative={maxCumulative} maxLevelSize={maxLevelSize} />
        ))}
      </div>
      <SpreadRow bestBid={bestBid} bestAsk={bestAsk} mid={mid} />
      <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
        {bidRows.map((row) => (
          <BookRow key={`bid-${row.price}`} row={row} maxCumulative={maxCumulative} maxLevelSize={maxLevelSize} />
        ))}
      </div>
    </div>
  );
}

function BookHeader() {
  return (
    <div className="grid shrink-0 grid-cols-3 text-[10px] uppercase tracking-[0.12em] text-exchange-500">
      <span>Price</span>
      <span className="text-right">Size</span>
      <span className="text-right">Total</span>
    </div>
  );
}

type BookSide = "bid" | "ask";
type BookRowData = {
  side: BookSide;
  price: number;
  size: number;
  cumulativeSize: number;
  cumulativeNotional: number;
};

function buildBookRows(levels: [number, number][], side: BookSide): BookRowData[] {
  let cumulativeSize = 0;

  return levels.map(([price, size]) => {
    cumulativeSize += size;
    return {
      side,
      price,
      size,
      cumulativeSize,
      cumulativeNotional: cumulativeSize * price,
    };
  });
}

function SpreadRow({ bestBid, bestAsk, mid }: { bestBid: number | null; bestAsk: number | null; mid: number | null }) {
  const spread = bestBid && bestAsk ? bestAsk - bestBid : null;
  const spreadBps = spread && mid ? (spread / mid) * 10_000 : null;

  return (
    <div className="my-2 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-y border-exchange-800 py-2">
      <span className="text-[10px] uppercase tracking-[0.12em] text-exchange-500">Spread</span>
      <div className="text-center">
        <p className="font-mono text-base font-semibold text-white">{mid ? formatNumber(mid) : "-"}</p>
        <p className="mt-0.5 text-[10px] text-exchange-500">
          {spread === null ? "-" : `${formatNumber(spread)} / ${spreadBps?.toFixed(2)} bps`}
        </p>
      </div>
      <span className="text-right text-[10px] uppercase tracking-[0.12em] text-exchange-500">Mid</span>
    </div>
  );
}

function BookRow({ row, maxCumulative, maxLevelSize }: { row: BookRowData; maxCumulative: number; maxLevelSize: number }) {
  const color = row.side === "bid" ? "text-emerald-300" : "text-rose-300";
  const cumulativeBar = row.side === "bid" ? "bg-emerald-400/10" : "bg-rose-400/10";
  const levelBar = row.side === "bid" ? "bg-emerald-300/22" : "bg-rose-300/22";
  const cumulativeWidth = `${Math.max(4, (row.cumulativeSize / maxCumulative) * 100)}%`;
  const levelWidth = `${Math.max(3, (row.size / maxLevelSize) * 100)}%`;

  return (
    <div className="relative grid h-6 grid-cols-3 items-center overflow-hidden px-1">
      <div className={`absolute inset-y-0 right-0 ${cumulativeBar}`} style={{ width: cumulativeWidth }} />
      <div className={`absolute inset-y-1 right-0 ${levelBar}`} style={{ width: levelWidth }} />
      <span className={`relative ${color}`}>{formatNumber(row.price)}</span>
      <span className="relative text-right text-exchange-200">{formatNumber(row.size)}</span>
      <span className="relative text-right text-exchange-400">{formatNumber(row.cumulativeNotional)}</span>
    </div>
  );
}
