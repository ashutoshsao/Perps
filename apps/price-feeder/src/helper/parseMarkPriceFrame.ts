export type MarkPriceTick = {
  feedSymbol: string;
  /** integer cents — floats never cross the boundary out of this module */
  price: number;
  time: number;
};

/**
 * Parses one raw Binance websocket frame into a mark-price tick, or null if
 * the frame isn't a markPriceUpdate event (subscribe ACKs, other stream
 * types, etc).
 *
 * Combined/stream-mode frames wrap the real event as `{ stream, data }` —
 * raw single-stream frames don't. Unwrapping both shapes here (instead of at
 * the call site) is what makes this testable without a live socket.
 */
export function parseMarkPriceFrame(raw: string): MarkPriceTick | null {
  const frame = JSON.parse(raw);
  const msg = frame.data ?? frame;
  if (msg.e !== "markPriceUpdate") return null;

  return {
    feedSymbol: msg.s,
    price: Math.round(parseFloat(msg.i) * 100),
    time: msg.E,
  };
}
