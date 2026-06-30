import { describe, expect, it } from "bun:test";
import { buildCandles } from "./useLiveCandles";
import type { Trade } from "../api/types";

function trade(time: string, price: number, qty: number): Trade {
  return {
    time,
    symbol: "BTC",
    price,
    qty,
    side: "buy",
  };
}

describe("buildCandles", () => {
  it("builds OHLCV per 1m candle", () => {
    const candles = buildCandles([], [
      trade("2026-06-30T10:00:05.000Z", 100, 2),
      trade("2026-06-30T10:00:20.000Z", 105, 1),
      trade("2026-06-30T10:00:45.000Z", 98, 3),
      trade("2026-06-30T10:00:55.000Z", 102, 4),
    ], "1m");

    expect(candles).toEqual([{
      bucket: "2026-06-30T10:00:00.000Z",
      open: 100,
      high: 105,
      low: 98,
      close: 102,
      volume: 10,
    }]);
  });

  it("separates trades by selected interval", () => {
    const trades = [
      trade("2026-06-30T10:01:00.000Z", 100, 1),
      trade("2026-06-30T10:04:00.000Z", 110, 1),
      trade("2026-06-30T10:06:00.000Z", 90, 1),
    ];

    expect(buildCandles([], trades, "5m").map((candle) => candle.bucket)).toEqual([
      "2026-06-30T10:00:00.000Z",
      "2026-06-30T10:05:00.000Z",
    ]);
    expect(buildCandles([], trades, "1h").map((candle) => candle.bucket)).toEqual([
      "2026-06-30T10:00:00.000Z",
    ]);
  });

  it("updates an existing snapshot candle without using mark price", () => {
    const candles = buildCandles([{
      bucket: "2026-06-30T10:00:00.000Z",
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1,
    }], [
      trade("2026-06-30T10:00:15.000Z", 95, 2),
      trade("2026-06-30T10:00:30.000Z", 106, 3),
    ], "1m");

    expect(candles[0]).toEqual({
      bucket: "2026-06-30T10:00:00.000Z",
      open: 100,
      high: 106,
      low: 95,
      close: 106,
      volume: 6,
    });
  });
});
