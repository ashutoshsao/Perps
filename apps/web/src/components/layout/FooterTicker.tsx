import { useState } from "react";
import { FireEmoji, SlidersIcon } from "../../icons";
import { useMarket } from "../../context/MarketContext";
import { useMarketMovers } from "../../hooks/useMarketMovers";

const FILTERS = ["All", "Gainers", "Losers"] as const;

export function FooterTicker() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [open, setOpen] = useState(false);
  const { markets } = useMarket();
  const movers = useMarketMovers(markets);

  const visible = movers.filter((m) => {
    if (filter === "Gainers") return m.positive;
    if (filter === "Losers") return !m.positive;
    return true;
  });

  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-6 border-t border-border-soft bg-panel px-3 text-[12px]">
      <div className="flex min-w-0 items-center gap-5 overflow-hidden">
        <div className="relative shrink-0">
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-text-muted hover:text-text">
            <SlidersIcon size={15} />
          </button>
          {open && (
            <div className="absolute bottom-8 left-0 z-20 w-32 rounded-lg border border-border bg-panel-2 p-1 shadow-xl">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFilter(f);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] ${
                    f === filter ? "bg-surface text-text" : "text-text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-text">
          <FireEmoji />
          Top Movers
        </span>

        {visible.length === 0 ? (
          <span className="text-text-dim">Loading movers...</span>
        ) : (
          visible.map((m) => (
            <span key={m.symbol} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              <span className="text-text-muted">{m.symbol}</span>
              <span className="text-text">{m.price}</span>
              <span className={m.positive ? "text-green" : "text-red"}>{m.pct}</span>
            </span>
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-text-muted">F</span>
        <span className="text-text-muted">Hourly Yield</span>
        <span className="rounded-md bg-surface px-2 py-1 text-text-dim" title="Not available yet">—</span>
      </div>
    </div>
  );
}
