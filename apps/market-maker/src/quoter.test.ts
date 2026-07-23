import { describe, expect, it } from "bun:test";
import { buildLadder } from "./quoter";
import type { MarketSpec } from "./config";

const spec: MarketSpec = {
  symbol: "BTC-PERP",
  imageUrl: "",
  maxLeverage: 50,
  minQty: 1,
  levels: 7,
  spreadBps: 1,
  stepBps: 2,
  quoteSize: [1, 3],
  takerSize: [1, 2],
};

// BTC around $118,456.78 in cents
const MID = 11_845_678;

describe("buildLadder", () => {
  it("never crosses itself: best bid strictly below best ask", () => {
    const quotes = buildLadder(MID, spec);
    const bids = quotes.filter((q) => q.side === "buy").map((q) => q.price);
    const asks = quotes.filter((q) => q.side === "sell").map((q) => q.price);
    expect(Math.max(...bids)).toBeLessThan(Math.min(...asks));
  });

  it("quotes strictly ordered integer-cent levels on both sides", () => {
    const quotes = buildLadder(MID, spec);
    const bids = quotes.filter((q) => q.side === "buy").map((q) => q.price);
    const asks = quotes.filter((q) => q.side === "sell").map((q) => q.price);

    for (const price of [...bids, ...asks]) expect(Number.isInteger(price)).toBe(true);
    for (let i = 1; i < bids.length; i++) expect(bids[i]!).toBeLessThan(bids[i - 1]!);
    for (let i = 1; i < asks.length; i++) expect(asks[i]!).toBeGreaterThan(asks[i - 1]!);
  });

  it("keeps levels distinct even when the price is too small for bps spacing", () => {
    // at $1.00 every bps offset rounds to the same cent — the ladder must still be strictly ordered
    const quotes = buildLadder(100, spec);
    const bids = quotes.filter((q) => q.side === "buy").map((q) => q.price);
    const asks = quotes.filter((q) => q.side === "sell").map((q) => q.price);
    expect(new Set(bids).size).toBe(bids.length);
    expect(new Set(asks).size).toBe(asks.length);
    expect(Math.max(...bids)).toBeLessThan(Math.min(...asks));
  });

  it("never quotes zero or negative prices or sub-minimum sizes", () => {
    for (const mid of [3, 100, MID]) {
      for (const quote of buildLadder(mid, spec)) {
        expect(quote.price).toBeGreaterThan(0);
        expect(quote.qty).toBeGreaterThanOrEqual(spec.minQty);
      }
    }
  });

  it("quotes the configured number of levels per side at normal prices", () => {
    const quotes = buildLadder(MID, spec);
    expect(quotes.filter((q) => q.side === "buy")).toHaveLength(spec.levels);
    expect(quotes.filter((q) => q.side === "sell")).toHaveLength(spec.levels);
  });
});
