import { useMemo } from "react";
import { useTrading } from "../../context/TradingContext";
import { formatUsd } from "../../lib/format";

const GREEN = "#00c896";
const RED = "#f6465d";

type DepthPoint = { price: number; cum: number };

// cumulative depth at a price = everything at that price or better (higher for bids, lower for asks)
function cumulativeSide(levels: [number, number][], direction: "bid" | "ask"): DepthPoint[] {
  const sorted = [...levels].sort((a, b) => (direction === "bid" ? b[0] - a[0] : a[0] - b[0]));
  let cum = 0;
  const points = sorted.map(([price, qty]) => {
    cum += qty;
    return { price, cum };
  });
  return direction === "bid" ? points.reverse() : points;
}

function stepPath(points: DepthPoint[], xScale: (price: number) => number, yScale: (cum: number) => number, baseY: number) {
  if (points.length === 0) return "";
  const xs = points.map((p) => xScale(p.price));
  const ys = points.map((p) => yScale(p.cum));
  let d = `M ${xs[0]} ${baseY} L ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${xs[i]} ${ys[i - 1]} L ${xs[i]} ${ys[i]}`;
  }
  d += ` L ${xs[xs.length - 1]} ${baseY} Z`;
  return d;
}

const WIDTH = 1000;
const HEIGHT = 320;
const PAD = 16;

export function DepthChart() {
  const { depth, bestBid, bestAsk } = useTrading();

  const bidPoints = useMemo(() => (depth ? cumulativeSide(depth.bids, "bid") : []), [depth]);
  const askPoints = useMemo(() => (depth ? cumulativeSide(depth.asks, "ask") : []), [depth]);

  if (!depth || (bidPoints.length === 0 && askPoints.length === 0)) {
    return <div className="flex h-full items-center justify-center text-[13px] text-text-dim">Depth unavailable</div>;
  }

  const minPrice = bidPoints[0]?.price ?? askPoints[0]!.price;
  const maxPrice = askPoints[askPoints.length - 1]?.price ?? bidPoints[bidPoints.length - 1]!.price;
  const maxCum = Math.max(bidPoints[bidPoints.length - 1]?.cum ?? 0, askPoints[askPoints.length - 1]?.cum ?? 0, 1);

  const xScale = (price: number) =>
    maxPrice === minPrice ? WIDTH / 2 : PAD + ((price - minPrice) / (maxPrice - minPrice)) * (WIDTH - PAD * 2);
  const yScale = (cum: number) => HEIGHT - PAD - (cum / maxCum) * (HEIGHT - PAD * 2);
  const baseY = yScale(0);

  const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null;

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full">
        <path d={stepPath(bidPoints, xScale, yScale, baseY)} fill={`${GREEN}2A`} stroke={GREEN} strokeWidth={1.5} />
        <path d={stepPath(askPoints, xScale, yScale, baseY)} fill={`${RED}2A`} stroke={RED} strokeWidth={1.5} />
        {midPrice !== null && (
          <line x1={xScale(midPrice)} y1={PAD} x2={xScale(midPrice)} y2={HEIGHT - PAD} stroke="#2a2d33" strokeDasharray="4 4" />
        )}
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-text-dim">${formatUsd(minPrice)}</div>
      <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-text-dim">${formatUsd(maxPrice)}</div>
      {midPrice !== null && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[11px] font-medium text-text">
          Mid ${formatUsd(midPrice)}
        </div>
      )}
    </div>
  );
}
