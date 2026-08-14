import { useMarket } from "../../context/MarketContext";
import { useMarketMovers } from "../../hooks/useMarketMovers";
import { MarketIcon } from "../ui/MarketIcon";

export function MobileMarketsBrowser({ onSelect }: { onSelect: () => void }) {
  const { markets, symbol, setSymbol, marketsLoading, marketsError } = useMarket();
  const movers = useMarketMovers(markets);
  const byMover = new Map(movers.map((m) => [m.symbol, m]));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {marketsError && <div className="px-4 py-3 text-[12px] text-red">Markets unavailable: {marketsError}</div>}
      {marketsLoading && markets.length === 0 && (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-text-dim">
          Loading markets…
        </div>
      )}
      {markets.map((m) => {
        const mover = byMover.get(m.symbol);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setSymbol(m.symbol);
              onSelect();
            }}
            className={`flex w-full items-center justify-between border-b border-border-soft px-4 py-3 text-left ${
              m.symbol === symbol ? "bg-surface" : ""
            }`}
          >
            <span className="flex items-center gap-2.5">
              <MarketIcon symbol={m.symbol} imageUrl={m.imageUrl} size={26} />
              <span className="flex flex-col">
                <span className="text-[14px] font-semibold text-text">{m.symbol}</span>
                <span className="text-[11px] text-text-dim">{m.maxLeverage}x max</span>
              </span>
            </span>
            <span className="flex flex-col items-end">
              <span className="text-[14px] font-medium text-text">{mover ? mover.price : "-"}</span>
              <span className={`text-[12px] ${mover ? (mover.positive ? "text-green" : "text-red") : "text-text-dim"}`}>
                {mover ? mover.pct : "-"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
