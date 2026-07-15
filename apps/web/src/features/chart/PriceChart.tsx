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
} from "lightweight-charts";
import type { Candle } from "../../api/types";

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
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  }));
}

function toVolumeData(candles: Candle[]): HistogramData[] {
  return candles.map((c) => ({
    time: toTime(c.bucket),
    value: Number(c.volume),
    color: Number(c.close) >= Number(c.open) ? "rgba(0, 200, 150, 0.5)" : "rgba(246, 70, 93, 0.5)",
  }));
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

export function PriceChart({
  candles,
  showVolume,
  range,
}: {
  candles: Candle[];
  showVolume: boolean;
  range: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

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
      timeScale: { borderColor: GRID, timeVisible: true, secondsVisible: false },
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
    candleSeriesRef.current?.setData(toCandlestickData(candles));
    volumeSeriesRef.current?.setData(showVolume ? toVolumeData(candles) : []);

    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;

    const seconds = RANGE_SECONDS[range];
    if (seconds == null) {
      chart.timeScale().fitContent();
    } else {
      const lastTime = toTime(candles[candles.length - 1]!.bucket);
      chart.timeScale().setVisibleRange({ from: (lastTime - seconds) as UTCTimestamp, to: lastTime });
    }
  }, [candles, showVolume, range]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
