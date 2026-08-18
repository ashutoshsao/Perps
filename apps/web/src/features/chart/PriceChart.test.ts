import { describe, expect, it } from "bun:test";

// Bun (like Node/V8) resolves the process's default ICU timezone once and caches it —
// mutating `process.env.TZ` mid-process does NOT change what `Date`/`Intl` resolve to
// afterwards. So to prove the formatters genuinely follow the *runtime's* timezone
// (the property that matters: an India-based viewer and a US-based viewer must see
// different local times for the same instant) each case runs in its own fresh process
// with TZ set before that process starts.
const MODULE_PATH = new URL("./PriceChart.tsx", import.meta.url).pathname;

// 2023-11-14T22:13:20Z — chosen so the local wall-clock hour AND calendar day differ
// between India and the US.
const EPOCH_SECONDS = 1700000000;

function formatInTz(tz: string, expr: string): string {
  const script = `
    import { localTickMarkFormatter, localTimeFormatter } from ${JSON.stringify(MODULE_PATH)};
    import { TickMarkType } from "lightweight-charts";
    console.log(${expr});
  `;
  const proc = Bun.spawnSync({
    cmd: ["bun", "-e", script],
    env: { ...process.env, TZ: tz },
    cwd: new URL("../../..", import.meta.url).pathname, // apps/web, so node_modules resolves
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`subprocess failed (TZ=${tz}): ${proc.stderr.toString()}`);
  }
  return proc.stdout.toString().trim();
}

describe("chart time formatters resolve to the viewer's local timezone", () => {
  it("renders different local time-of-day for an India viewer vs a US viewer", () => {
    const ist = formatInTz("Asia/Kolkata", `localTickMarkFormatter(${EPOCH_SECONDS}, TickMarkType.Time)`);
    const et = formatInTz("America/New_York", `localTickMarkFormatter(${EPOCH_SECONDS}, TickMarkType.Time)`);

    // Same instant, +5:30 vs -5:00 → 10.5 hour offset, so the two must disagree.
    expect(ist).not.toBe(et);
    expect(ist).toBe("03:43");
    expect(et).toBe("17:13");
  });

  it("crosses the calendar day boundary correctly for India (UTC+5:30)", () => {
    const day = formatInTz("Asia/Kolkata", `localTickMarkFormatter(${EPOCH_SECONDS}, TickMarkType.DayOfMonth)`);
    // 22:13 UTC on the 14th is already the 15th in Kolkata.
    expect(day).toBe("Nov 15");
  });

  it("stays on the prior calendar day for US Eastern", () => {
    const day = formatInTz("America/New_York", `localTickMarkFormatter(${EPOCH_SECONDS}, TickMarkType.DayOfMonth)`);
    expect(day).toBe("Nov 14");
  });

  it("includes seconds only for the TimeWithSeconds tick type", () => {
    const withSeconds = formatInTz("UTC", `localTickMarkFormatter(${EPOCH_SECONDS}, TickMarkType.TimeWithSeconds)`);
    const withoutSeconds = formatInTz("UTC", `localTickMarkFormatter(${EPOCH_SECONDS}, TickMarkType.Time)`);
    expect(withSeconds).toBe("22:13:20");
    expect(withoutSeconds).toBe("22:13");
  });

  it("crosshair tooltip formatter agrees with the tick formatter's local resolution", () => {
    const tooltip = formatInTz("Asia/Kolkata", `localTimeFormatter(${EPOCH_SECONDS})`);
    expect(tooltip).toContain("03:43:20");
    expect(tooltip).toContain("2023");
  });
});
