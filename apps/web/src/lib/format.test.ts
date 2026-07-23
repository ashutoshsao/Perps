import { describe, expect, it } from "bun:test";
import { formatUsd, parseUsdToCents, usd } from "./format";

describe("cents boundary", () => {
  it("parses dollar input into exact integer cents", () => {
    expect(parseUsdToCents("118456.78")).toBe(11845678);
    expect(parseUsdToCents("1")).toBe(100);
    expect(parseUsdToCents("0.01")).toBe(1);
  });

  it("survives binary-float dollar amounts without drifting a cent", () => {
    // 184.56 * 100 === 18455.999999999996 in IEEE754 — the boundary must round, never floor
    expect(parseUsdToCents("184.56")).toBe(18456);
    expect(parseUsdToCents("0.29")).toBe(29);
    expect(parseUsdToCents("1.15")).toBe(115);
  });

  it("rejects non-positive and malformed input", () => {
    expect(parseUsdToCents("0")).toBeNull();
    expect(parseUsdToCents("-5")).toBeNull();
    expect(parseUsdToCents("abc")).toBeNull();
    expect(parseUsdToCents("")).toBeNull();
  });

  it("round-trips display conversion", () => {
    expect(usd(11845678)).toBe(118456.78);
    expect(formatUsd(11845678)).toBe("118,456.78");
    expect(formatUsd("100")).toBe("1");
  });
});
