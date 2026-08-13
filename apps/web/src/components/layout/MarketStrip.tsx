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
import { formatCountdown, formatUsd } from "../../lib/format";
import { useCountdown } from "../../hooks/useCountdown";
import { useAsyncData } from "../../hooks/useAsyncData";
import { api } from "../../api/client";

const FUNDING_INFO_POLL_MS = 60_000;

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
  const { market, markets, symbol, setSymbol, ticker, markPrice, indexPrice, fundingRate, marketsError } = useMarket();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [fundingTick, setFundingTick] = useState(0);
  useEffect(() => {
    setFundingTick(0);
    if (!symbol) return;
    const interval = setInterval(() => setFundingTick((t) => t + 1), FUNDING_INFO_POLL_MS);
    return () => clearInterval(interval);
  }, [symbol]);
  const fundingInfo = useAsyncData(
    () => (symbol ? api.getFundingInfo(symbol) : Promise.resolve(null)),
    [symbol, fundingTick],
  );
  const fundingCountdown = useCountdown(fundingInfo.data?.nextSettlementAt ?? null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tone = getTickerTone(ticker);
  const toneClass = tone === "negative" ? "text-red" : tone === "positive" ? "text-green" : "text-text";
  const fundingTone = getFundingTone(fundingRate);
  const fundingClass = fundingTone === "negative" ? "text-red" : fundingTone === "positive" ? "text-green" : "text-text";

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

      <Stat label="Index Price" value={formatMarkPrice(indexPrice)} />
      <Stat label="Funding Rate" value={formatFundingRate(fundingRate)} valueClass={fundingClass} />
      <Stat label="Next Funding" value={formatCountdown(fundingCountdown)} />
      <Stat label="24H Change" value={formatTickerChange(ticker)} valueClass={toneClass} />
      <Stat label="24H High" value={ticker ? formatUsd(ticker.high) : "-"} />
      <Stat label="24H Low" value={ticker ? formatUsd(ticker.low) : "-"} />
      <Stat label="24H Volume" value={formatTickerVolume(ticker)} />
    </div>
  );
}
