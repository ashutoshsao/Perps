import {
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle, Ticker } from "../../api/types";

type Props = {
  candles: Candle[];
  ticker: Ticker | null;
  markPrice?: number;
  symbol: string;
  isLoading: boolean;
  error: string | null;
  className?: string;
};

export function CandlestickChart({ candles, ticker, markPrice, symbol, isLoading, error, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const fittedSymbolRef = useRef<string | null>(null);
  const [hoverCandle, setHoverCandle] = useState<CandlestickData | null>(null);
  const data = useMemo(() => candles.map(toCandlestickData).filter(Boolean) as CandlestickData[], [candles]);
  const volumeData = useMemo(() => candles.map(toVolumeData).filter(Boolean) as HistogramData[], [candles]);
  const latestCandle = data.at(-1);
  const currentCandle = hoverCandle ?? latestCandle;
  const latestClose = data.at(-1)?.close;

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#081116" },
        textColor: "#6c818d",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        horzLines: { color: "#172329" },
        vertLines: { color: "#172329" },
      },
      rightPriceScale: {
        borderColor: "#172329",
        scaleMargins: {
          top: 0.08,
          bottom: 0.28,
        },
      },
      timeScale: {
        borderColor: "#172329",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 16,
        minBarSpacing: 8,
        rightOffset: 10,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(148, 163, 184, 0.32)",
          labelBackgroundColor: "#172329",
        },
        horzLine: {
          color: "rgba(148, 163, 184, 0.32)",
          labelBackgroundColor: "#172329",
        },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb7185",
      borderUpColor: "#34d399",
      borderDownColor: "#fb7185",
      wickUpColor: "#34d399",
      wickDownColor: "#fb7185",
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeSeriesRef.current = volumeSeries;

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const hovered = param.seriesData.get(series) as CandlestickData | undefined;
      setHoverCandle(hovered ?? null);
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(data);
    if (data.length > 0 && fittedSymbolRef.current !== symbol) {
      chartRef.current?.timeScale().fitContent();
      fittedSymbolRef.current = symbol;
    }
  }, [data, symbol]);

  useEffect(() => {
    if (!volumeSeriesRef.current) return;
    volumeSeriesRef.current.setData(volumeData);
  }, [volumeData]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current) {
      series.removePriceLine(line);
    }

    const lines: IPriceLine[] = [];
    if (latestCandle) {
      lines.push(series.createPriceLine({
        price: latestCandle.open,
        color: "rgba(148, 163, 184, 0.72)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "",
      }));
      lines.push(series.createPriceLine({
        price: latestCandle.close,
        color: "rgba(34, 211, 238, 0.82)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "",
      }));
    }

    const normalizedMarkPrice = normalizeMarkPrice(markPrice);
    if (normalizedMarkPrice) {
      lines.push(series.createPriceLine({
        price: normalizedMarkPrice,
        color: "rgba(250, 204, 21, 0.88)",
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: "Mark",
      }));
    }

    priceLinesRef.current = lines;
  }, [latestCandle, markPrice]);

  return (
    <div className={`relative min-h-[360px] overflow-hidden bg-[linear-gradient(180deg,#0d171c,#081116)] ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-7rem)] px-1 py-1 [text-shadow:0_1px_8px_rgba(0,0,0,0.92)]">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-exchange-500">{symbol}</p>
        <p className="mt-2 font-mono text-xl font-semibold leading-none text-white sm:text-2xl">{formatDisplayPrice(latestClose, ticker, symbol)}</p>
        {currentCandle ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
            <Readout label="O" value={currentCandle.open} />
            <Readout label="H" value={currentCandle.high} tone="text-emerald-300" />
            <Readout label="L" value={currentCandle.low} tone="text-rose-300" />
            <Readout label="C" value={currentCandle.close} />
            <Readout label="V" value={currentVolume(candles, currentCandle.time)} />
            <span className={candleChangeTone(currentCandle)}>{formatCandleChange(currentCandle)}</span>
          </div>
        ) : (
          <p className={`mt-1 font-mono text-xs ${getTickerTone(ticker)}`}>{formatTickerChange(ticker)} / 24h</p>
        )}
      </div>
      {isLoading ? <ChartOverlay message="Loading candles" /> : null}
      {error ? <ChartOverlay message={`Candles unavailable: ${error}`} /> : null}
      {!isLoading && !error && data.length === 0 ? <ChartOverlay message="No candles yet" /> : null}
    </div>
  );
}

function Readout({ label, value, tone = "text-exchange-200" }: { label: string; value: number; tone?: string }) {
  return (
    <span className={tone}>
      <span className="text-exchange-500">{label}</span> {formatNumber(value)}
    </span>
  );
}

function ChartOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-exchange-950/40">
      <div className="border border-exchange-800 bg-exchange-900/90 px-4 py-3 text-sm text-exchange-300">
        {message}
      </div>
    </div>
  );
}

function toCandlestickData(candle: Candle): CandlestickData | null {
  const time = Math.floor(new Date(candle.bucket).getTime() / 1000) as Time;
  if (!Number.isFinite(time)) return null;

  return {
    time,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  };
}

function toVolumeData(candle: Candle): HistogramData | null {
  const time = Math.floor(new Date(candle.bucket).getTime() / 1000) as Time;
  const open = Number(candle.open);
  const close = Number(candle.close);
  const value = Number(candle.volume);
  if (!Number.isFinite(time) || !Number.isFinite(value)) return null;

  return {
    time,
    value,
    color: close >= open ? "rgba(52, 211, 153, 0.22)" : "rgba(251, 113, 133, 0.22)",
  };
}

function formatTickerLast(ticker: Ticker | null, symbol: string) {
  if (!ticker) return symbol;
  return formatNumber(ticker.close);
}

function formatDisplayPrice(latestClose: number | undefined, ticker: Ticker | null, symbol: string) {
  if (typeof latestClose === "number" && Number.isFinite(latestClose)) return formatNumber(latestClose);
  return formatTickerLast(ticker, symbol);
}

function normalizeMarkPrice(markPrice: number | undefined) {
  if (typeof markPrice !== "number" || !Number.isFinite(markPrice)) return null;
  return markPrice / 1_000_000;
}

function formatTickerChange(ticker: Ticker | null) {
  if (!ticker) return "-";
  const pct = Number(ticker.changePct);
  if (!Number.isFinite(pct)) return `${ticker.changePct}%`;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function currentVolume(candles: Candle[], time: Time) {
  const candle = candles.find((item) => Math.floor(new Date(item.bucket).getTime() / 1000) === Number(time));
  const value = Number(candle?.volume ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function formatCandleChange(candle: CandlestickData) {
  const change = candle.close - candle.open;
  const pct = candle.open === 0 ? 0 : (change / candle.open) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${formatNumber(change)} (${sign}${pct.toFixed(2)}%)`;
}

function candleChangeTone(candle: CandlestickData) {
  if (candle.close > candle.open) return "text-emerald-300";
  if (candle.close < candle.open) return "text-rose-300";
  return "text-exchange-400";
}

function getTickerTone(ticker: Ticker | null) {
  const pct = Number(ticker?.changePct);
  if (!Number.isFinite(pct)) return "text-exchange-400";
  return pct >= 0 ? "text-emerald-300" : "text-rose-300";
}

function formatNumber(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(numeric);
}
