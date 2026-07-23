import { describe, expect, it } from "bun:test";
import { parseMarkPriceFrame } from "./parseMarkPriceFrame";

describe("parseMarkPriceFrame", () => {
  it("unwraps combined/stream-mode frames ({ stream, data })", () => {
    // regression: an earlier version read msg.e/msg.s/msg.i off the raw frame,
    // which is the raw single-stream shape — under /market/stream (required
    // for dynamic post-connect SUBSCRIBE) every event is wrapped, so real
    // ticks were silently dropped even once the socket was subscribed
    const raw = JSON.stringify({
      stream: "btcusdt@markPrice@1s",
      data: {
        e: "markPriceUpdate",
        E: 1784804631002,
        s: "BTCUSDT",
        p: "65668.90000000",
        i: "65703.29434783",
        r: "0.00000019",
      },
    });

    expect(parseMarkPriceFrame(raw)).toEqual({
      feedSymbol: "BTCUSDT",
      price: 6570329, // round(65703.29434783 * 100)
      time: 1784804631002,
    });
  });

  it("rounds sub-cent prices down to zero rather than crashing or drifting", () => {
    const raw = JSON.stringify({
      stream: "pumpusdt@markPrice@1s",
      data: { e: "markPriceUpdate", E: 1, s: "PUMPUSDT", i: "0.00194490" },
    });

    expect(parseMarkPriceFrame(raw)!.price).toBe(0);
  });

  it("ignores non-markPriceUpdate frames (SUBSCRIBE acks, other event types)", () => {
    expect(parseMarkPriceFrame(JSON.stringify({ result: null, id: 1 }))).toBeNull();
    expect(
      parseMarkPriceFrame(
        JSON.stringify({ stream: "btcusdt@aggTrade", data: { e: "aggTrade", s: "BTCUSDT" } }),
      ),
    ).toBeNull();
  });

  it("also handles raw single-stream frames (no envelope) for completeness", () => {
    const raw = JSON.stringify({ e: "markPriceUpdate", E: 5, s: "ETHUSDT", i: "3200.00" });
    expect(parseMarkPriceFrame(raw)).toEqual({ feedSymbol: "ETHUSDT", price: 320000, time: 5 });
  });
});
