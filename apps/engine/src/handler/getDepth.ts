import { GetDepthPayload } from "@repo/types";
import { ORDERBOOKS } from "../engine-store";

export function getDepth(payload: GetDepthPayload) {
  const { symbol } = payload;
  const orderbook = ORDERBOOKS.get(symbol);
  if (!orderbook) throw new Error(`market ${symbol} doesn't exist`);
  //asks stop at 20
  let asks: [number, number][] = [];
  orderbook.asks.forEachPair((askPrice, restingOrders) => {
    if (asks.length >= 20) return { break: 0 };
    let totalQty = restingOrders.reduce((sum, o) => sum + (o.qty - o.filledQty), 0);
    asks.push([askPrice, totalQty]);
  });

  //bids stop at 20
  let bids: [number, number][] = [];
  for (const [bidPrice, restingOrders] of orderbook.bids.entriesReversed()) {
    if (bids.length >= 20) break;
    let totalQty = restingOrders.reduce((sum, o) => sum + (o.qty - o.filledQty), 0);
    bids.push([bidPrice, totalQty]);
  };
  return { symbol, asks, bids };
}
