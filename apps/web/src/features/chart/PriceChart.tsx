import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type WhitespaceData,
} from "lightweight-charts";
import type { Candle } from "../../api/types";
import { usd } from "../../lib/format";

const GREEN = "#00c896";
const RED = "#f6465d";
const GRID = "#1a1c20";
const AXIS_TEXT = "#5c6068";

function toTime(bucket: string): UTCTimestamp {
  return Math.floor(new Date(bucket).getTime() / 1000) as UTCTimestamp;
}

function toCandlestickData(candles: Candle[]): CandlestickData[] {
  return candles.map((c) => ({
    time: toTime(c.bucket),
    open: usd(c.open),
    high: usd(c.high),
    low: usd(c.low),
    close: usd(c.close),
  }));
}

function toVolumeData(candles: Candle[]): HistogramData[] {
  return candles.map((c) => ({
    time: toTime(c.bucket),
    value: Number(c.volume),
    color: Number(c.close) >= Number(c.open) ? "rgba(0, 200, 150, 0.5)" : "rgba(246, 70, 93, 0.5)",
  }));
}

const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

// Sparse markets can have a handful of candles (or just one), which leaves the
// time scale with almost no ticks. Pad the series with whitespace buckets so the
// axis always spans a real time window and gaps between candles stay linear.
const MIN_VISIBLE_BARS = 60;

function padWithWhitespace(
  data: CandlestickData[],
  intervalSeconds: number,
): (CandlestickData | WhitespaceData)[] {
  if (data.length === 0) return data;

  const byTime = new Map<number, CandlestickData>(data.map((d) => [d.time as number, d]));
  const last = data[data.length - 1]!.time as number;
  const first = data[0]!.time as number;
  const start = Math.min(first, last - (MIN_VISIBLE_BARS - 1) * intervalSeconds);

  const out: (CandlestickData | WhitespaceData)[] = [];
  for (let t = start; t <= last; t += intervalSeconds) {
    out.push(byTime.get(t) ?? { time: t as UTCTimestamp });
  }
  // Keep any real candles that fall off the aligned grid.
  for (const d of data) {
    if ((((d.time as number) - start) % intervalSeconds) !== 0 || (d.time as number) < start) {
      out.push(d);
    }
  }
  return out.sort((a, b) => (a.time as number) - (b.time as number));
}

const RANGE_SECONDS: Record<string, number | null> = {
  All: null,
  "1y": 365 * 86400,
  "6m": 182 * 86400,
  "3m": 90 * 86400,
  "1m": 30 * 86400,
  "5d": 5 * 86400,
  "1d": 86400,
};

// only called on initial load / explicit range change, never on a routine candle tick
function applyVisibleRange(chart: IChartApi | null, candles: Candle[], range: string) {
  if (!chart || candles.length === 0) return;

  const seconds = RANGE_SECONDS[range];
  const lastTime = toTime(candles[candles.length - 1]!.bucket);
  if (seconds == null) {
    chart.timeScale().fitContent();
    return;
  }
  // clamp to earliest candle we have, otherwise a long range on a young market looks empty
  const firstTime = toTime(candles[0]!.bucket);
  const from = Math.max(lastTime - seconds, firstTime);
  chart.timeScale().setVisibleRange({ from: from as UTCTimestamp, to: lastTime });
}

export function PriceChart({
  candles,
  showVolume,
  range,
  interval,
}: {
  candles: Candle[];
  showVolume: boolean;
  range: string;
  interval: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const dataReadyRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: AXIS_TEXT,
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID, timeVisible: true, secondsVisible: false, rightOffset: 5 },
      crosshair: { mode: 0 },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: GREEN,
      downColor: RED,
      borderVisible: false,
      wickUpColor: GREEN,
      wickDownColor: RED,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.24 } });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const intervalSeconds = INTERVAL_SECONDS[interval] ?? 60;
    candleSeriesRef.current?.setData(padWithWhitespace(toCandlestickData(candles), intervalSeconds));
    volumeSeriesRef.current?.setData(showVolume ? toVolumeData(candles) : []);

    if (candles.length === 0) {
      // symbol switched (or still loading) — re-fit once real data lands again
      dataReadyRef.current = false;
    } else if (!dataReadyRef.current) {
      dataReadyRef.current = true;
      applyVisibleRange(chartRef.current, candles, range);
    }
  }, [candles, showVolume, interval]);

  useEffect(() => {
    if (!dataReadyRef.current) return;
    applyVisibleRange(chartRef.current, candlesRef.current, range);
  }, [range, interval]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
