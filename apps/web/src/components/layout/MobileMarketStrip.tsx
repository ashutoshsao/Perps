import { useEffect, useRef, useState } from "react";
import { BitcoinGlyph, ChevronDownIcon } from "../../icons";
import { Pill } from "../ui/Pill";
import { useMarket } from "../../context/MarketContext";
import {
  formatFundingRate,
  formatLastPrice,
  formatMarkPrice,
  formatTickerChange,
  formatTickerVolume,
  getFundingTone,
  getTickerTone,
} from "../../lib/markets";
import { formatUsd } from "../../lib/format";

export function MobileMarketStrip() {
  const { market, markets, symbol, setSymbol, ticker, markPrice, indexPrice, fundingRate, marketsError } = useMarket();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tone = getTickerTone(ticker);
  const toneClass = tone === "negative" ? "text-red" : tone === "positive" ? "text-green" : "text-text";
  const fundingTone = getFundingTone(fundingRate);
  const fundingClass = fundingTone === "negative" ? "text-red" : fundingTone === "positive" ? "text-green" : "text-text";

  return (
    <div className="shrink-0 border-b border-border-soft bg-panel">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="relative" ref={ref}>
          <button type="button" onClick={() => setPickerOpen((v) => !v)} className="flex items-center gap-1.5">
            <BitcoinGlyph size={22} />
            <span className="text-[14px] font-bold text-text">{market?.symbol ?? symbol ?? "..."}</span>
            {market && <Pill>{market.maxLeverage}x</Pill>}
            <ChevronDownIcon size={13} className={`text-text-muted ${pickerOpen ? "rotate-180" : ""} transition-transform`} />
          </button>

          {pickerOpen && (
            <div className="absolute left-0 top-9 z-20 w-56 rounded-lg border border-border bg-panel-2 p-1 shadow-xl">
              {marketsError && <div className="px-3 py-2 text-[12px] text-red">Markets unavailable: {marketsError}</div>}
              {markets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSymbol(m.symbol);
                    setPickerOpen(false);
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

        <button type="button" onClick={() => setStatsOpen((v) => !v)} className="flex flex-col items-end gap-0.5">
          <span className={`text-[18px] font-bold leading-none ${toneClass}`}>{formatLastPrice(ticker)}</span>
          <span className={`text-[12px] leading-none ${toneClass}`}>{formatTickerChange(ticker)}</span>
        </button>
      </div>

      {statsOpen && (
        <div className="grid grid-cols-2 gap-y-2 border-t border-border-soft px-3 py-2.5 text-[12px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-text-dim">Mark Price</span>
            <span className="text-text">{formatMarkPrice(markPrice)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-text-dim">Index Price</span>
            <span className="text-text">{formatMarkPrice(indexPrice)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-text-dim">Funding Rate</span>
            <span className={fundingClass}>{formatFundingRate(fundingRate)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-text-dim">24H Volume</span>
            <span className="text-text">{formatTickerVolume(ticker)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-text-dim">24H High</span>
            <span className="text-text">{ticker ? formatUsd(ticker.high) : "-"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-text-dim">24H Low</span>
            <span className="text-text">{ticker ? formatUsd(ticker.low) : "-"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
