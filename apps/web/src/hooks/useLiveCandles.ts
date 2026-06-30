import type { Candle, Trade } from "../api/types";
import { useMemo } from "react";

export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const intervalMs: Record<ChartInterval, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

function bucketIso(time: string, interval: ChartInterval) {
  const ms = new Date(time).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(Math.floor(ms / intervalMs[interval]) * intervalMs[interval]).toISOString();
}

function applyTrade(candlesByBucket: Map<string, Candle>, trade: Trade, interval: ChartInterval) {
  const bucket = bucketIso(trade.time, interval);
  const price = Number(trade.price);
  const qty = Number(trade.qty);
  if (!bucket || !Number.isFinite(price) || !Number.isFinite(qty)) return;

  const existing = candlesByBucket.get(bucket);
  if (!existing) {
    candlesByBucket.set(bucket, {
      bucket,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: qty,
    });
    return;
  }

  candlesByBucket.set(bucket, {
    ...existing,
    high: Math.max(Number(existing.high), price),
    low: Math.min(Number(existing.low), price),
    close: price,
    volume: Number(existing.volume) + qty,
  });
}

export function buildCandles(snapshotCandles: Candle[], liveTrades: Trade[], interval: ChartInterval) {
  const candlesByBucket = new Map<string, Candle>();

  for (const candle of snapshotCandles) {
    candlesByBucket.set(new Date(candle.bucket).toISOString(), candle);
  }

  for (const trade of [...liveTrades].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())) {
    applyTrade(candlesByBucket, trade, interval);
  }

  return Array.from(candlesByBucket.values()).sort(
    (a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime(),
  );
}

export function useLiveCandles(snapshotCandles: Candle[], liveTrades: Trade[], interval: ChartInterval) {
  return useMemo(() => buildCandles(snapshotCandles, liveTrades, interval), [snapshotCandles, liveTrades, interval]);
}
