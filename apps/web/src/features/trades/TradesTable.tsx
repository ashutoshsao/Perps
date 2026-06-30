import type { Trade } from "../../api/types";
import { formatNumber, formatTime } from "../../lib/format";
import { PanelState } from "../../components/ui";

export function TradesTable({ trades, isLoading, error }: { trades: Trade[]; isLoading: boolean; error: string | null }) {
  if (isLoading) return <PanelState message="Loading trades" detail="Fetching recent fills for the selected market." />;
  if (error) return <PanelState message={`Trades unavailable: ${error}`} />;
  if (trades.length === 0) {
    return <PanelState message="No recent trades" detail="Matched orders will show here after the engine publishes fills." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-3 font-mono text-xs">
      <div className="grid shrink-0 grid-cols-3 text-[10px] uppercase tracking-[0.12em] text-exchange-500">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {trades.map((trade) => (
          <div key={`${trade.time}-${trade.price}-${trade.qty}`} className="grid h-7 grid-cols-3 items-center px-1 hover:bg-exchange-800/70">
            <span className={trade.side === "buy" ? "text-emerald-300" : "text-rose-300"}>
              <span className="mr-1 text-[9px]">{trade.side === "buy" ? "B" : "S"}</span>
              {formatNumber(trade.price)}
            </span>
            <span className="text-right text-exchange-200">{formatNumber(trade.qty)}</span>
            <span className="text-right text-exchange-500">{formatTime(trade.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
