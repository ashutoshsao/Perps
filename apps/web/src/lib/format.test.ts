import { describe, expect, it } from "bun:test";
import { formatUsd, localTimeZoneLabel, parseUsdToCents, usd } from "./format";

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

describe("localTimeZoneLabel", () => {
  it("matches what Intl resolves for the current runtime, not a hardcoded/UTC value", () => {
    // Resolved once at module load from the process's own TZ (same source browsers use),
    // so this must agree with asking Intl directly right now — it must never be a literal
    // like "UTC" baked in regardless of environment.
    const expected = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    expect(localTimeZoneLabel).toBe(expected ?? "Local");
  });

  it("is a non-empty label safe to render directly in the UI", () => {
    expect(typeof localTimeZoneLabel).toBe("string");
    expect(localTimeZoneLabel.length).toBeGreaterThan(0);
  });
});
