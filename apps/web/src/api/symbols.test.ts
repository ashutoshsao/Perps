import { describe, expect, it } from "bun:test";
import { normalizeMarketSymbol } from "./symbols";

describe("normalizeMarketSymbol", () => {
  it("normalizes display and pair symbols to the internal base symbol", () => {
    expect(normalizeMarketSymbol("BTC")).toBe("BTC");
    expect(normalizeMarketSymbol("btc")).toBe("BTC");
    expect(normalizeMarketSymbol("BTC-USD")).toBe("BTC");
    expect(normalizeMarketSymbol("BTC/USD")).toBe("BTC");
    expect(normalizeMarketSymbol("BTCUSD")).toBe("BTC");
  });
});
