import { useEffect, useRef, useState } from "react";
import { BitcoinGlyph, ChevronDownIcon } from "../../icons";
import { Pill } from "../ui/Pill";
import { useMarket } from "../../context/MarketContext";
import {
  formatLastPrice,
  formatMarkPrice,
  formatTickerChange,
  formatTickerVolume,
  getTickerTone,
} from "../../lib/markets";
import { formatNumber } from "../../lib/format";

function Stat({
  label,
  value,
  valueClass = "text-text",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1 whitespace-nowrap">
      <span className="text-[11px] font-medium text-text-dim">{label}</span>
      <span className={`text-[13px] font-medium leading-none ${valueClass}`}>{value}</span>
    </div>
  );
}

export function MarketStrip() {
  const { market, markets, symbol, setSymbol, ticker, markPrice, marketsError } = useMarket();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tone = getTickerTone(ticker);
  const toneClass = tone === "negative" ? "text-red" : tone === "positive" ? "text-green" : "text-text";

  return (
    <div className="flex h-[72px] shrink-0 items-center gap-8 border-b border-border-soft bg-panel px-6">
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2">
          <BitcoinGlyph size={26} />
          <span className="text-[16px] font-bold text-text">{market?.symbol ?? symbol ?? "..."}</span>
          {market && <Pill>{market.maxLeverage}x</Pill>}
          <ChevronDownIcon size={14} className={`text-text-muted ${open ? "rotate-180" : ""} transition-transform`} />
        </button>

        {open && (
          <div className="absolute left-0 top-10 z-20 w-64 rounded-lg border border-border bg-panel-2 p-1 shadow-xl">
            {marketsError && (
              <div className="px-3 py-2 text-[12px] text-red">Markets unavailable: {marketsError}</div>
            )}
            {markets.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSymbol(m.symbol);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] hover:bg-surface ${
                  m.symbol === symbol ? "text-text" : "text-text-muted"
                }`}
              >
                <span className="font-medium">{m.symbol}</span>
                <span className="text-text-dim">{m.maxLeverage}x</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className={`text-[22px] font-bold leading-none ${toneClass}`}>{formatLastPrice(ticker)}</span>
        <span className="text-[12px] text-text-dim">{formatMarkPrice(markPrice)}</span>
      </div>

      <Stat label="Index Price" value={formatMarkPrice(markPrice)} />
      <Stat label="24H Change" value={formatTickerChange(ticker)} valueClass={toneClass} />
      <Stat label="24H High" value={ticker ? formatNumber(ticker.high) : "-"} />
      <Stat label="24H Low" value={ticker ? formatNumber(ticker.low) : "-"} />
      <Stat label="24H Volume (USD)" value={formatTickerVolume(ticker)} />
    </div>
  );
}
