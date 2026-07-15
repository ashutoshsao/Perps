import { useRef, useState } from "react";
import { SegmentedControl, TextTabs } from "../../components/ui/Tabs";
import { ChartToolbar } from "./ChartToolbar";
import { PriceChart } from "./PriceChart";
import { chartTabs } from "../../data/mockMarket";
import { useMarket } from "../../context/MarketContext";
import { useTrading } from "../../context/TradingContext";
import { useToast } from "../../context/ToastContext";
import { formatNumber } from "../../lib/format";

const ranges = ["All", "1y", "6m", "3m", "1m", "5d", "1d"];
const scaleToggles = ["%", "log", "auto"];

export function ChartPanel() {
  const [tab, setTab] = useState("Chart");
  const [priceSource, setPriceSource] = useState("Last");
  const [range, setRange] = useState("All");
  const [scale, setScale] = useState("auto");
  const [showVolume, setShowVolume] = useState(true);

  const { market, ticker } = useMarket();
  const { candles, candlesLoading, candlesError, chartInterval, setChartInterval, tradesLive, tradesError } = useTrading();
  const { push } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => push("Fullscreen isn't supported here", "error"));
    } else {
      document.exitFullscreen();
    }
  };

  const handleReset = () => {
    setRange("All");
    setScale("auto");
    setPriceSource("Last");
    setChartInterval("1m");
    push("Chart view reset");
  };

  const latest = candles[candles.length - 1];
  const ohlc = latest
    ? {
        open: formatNumber(latest.open),
        high: formatNumber(latest.high),
        low: formatNumber(latest.low),
        close: formatNumber(latest.close),
      }
    : null;

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border-soft bg-bg">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-soft px-4">
        <TextTabs items={chartTabs} active={tab} onChange={setTab} />
        <SegmentedControl items={["Last", "Mark", "Index"]} active={priceSource} onChange={setPriceSource} />
      </div>

      <ChartToolbar
        interval={chartInterval}
        onIntervalChange={setChartInterval}
        showVolume={showVolume}
        onToggleVolume={() => setShowVolume((v) => !v)}
        onFullscreen={handleFullscreen}
        onReset={handleReset}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden px-1 pt-2">
        <div className="pointer-events-none absolute left-3 top-2 z-10 flex items-center gap-1.5 text-[12px] text-text-muted">
          <span className="font-medium text-text">{market?.symbol ?? "Loading markets"} · {chartInterval} · Backpack</span>
          <span className={`h-1.5 w-1.5 rounded-full ${tradesLive ? "bg-green" : "bg-text-dim"}`} />
          {ohlc && (
            <span>
              O<span className="text-text">{ohlc.open}</span> H<span className="text-text">{ohlc.high}</span> L
              <span className="text-text">{ohlc.low}</span> C<span className="text-text">{ohlc.close}</span>
            </span>
          )}
        </div>

        {candlesError && candles.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-red">Chart unavailable: {candlesError}</div>
        ) : candlesLoading && candles.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-text-dim">Loading chart...</div>
        ) : (
          <PriceChart candles={candles} showVolume={showVolume} range={range} />
        )}
        {tradesError && (
          <div className="pointer-events-none absolute bottom-2 left-3 z-10 text-[11px] text-red">Live trades unavailable: {tradesError}</div>
        )}
      </div>

      <div className="flex h-9 shrink-0 items-center justify-between border-t border-border-soft px-3">
        <div className="flex items-center gap-4">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`text-[12px] font-medium ${
                range === r ? "text-text" : "text-text-muted hover:text-text"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[12px] text-text-muted">{ticker ? "Live" : "-"}</span>
          {scaleToggles.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={`text-[12px] font-medium ${
                scale === s ? "text-blue" : "text-text-muted hover:text-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
