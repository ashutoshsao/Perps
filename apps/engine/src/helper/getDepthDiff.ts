import { MARKET_UPDATE_IDS, ORDERBOOKS } from "../engine-store"

export type DepthDiff = {
  symbol: string
  firstUpdateId: number,
  finalUpdateId: number,
  prevUpdateId: number,
  bids: [number, number][]  // [price, newTotalQty] — 0 means removed
  asks: [number, number][]
}

export function getDepthDiff(
  symbol: string,
  touchedBidPrices: number[],
  touchedAskPrices: number[]
): DepthDiff {
  const orderbook = ORDERBOOKS.get(symbol)
  if (!orderbook) throw new Error(`market ${symbol} doesn't exist`)

  const prevUpdateId = MARKET_UPDATE_IDS.get(symbol) ?? 0;
  const finalUpdateId = prevUpdateId + 1;
  MARKET_UPDATE_IDS.set(symbol, finalUpdateId);

  const bids: [number, number][] = touchedBidPrices.map(price => {
    const orders = orderbook.bids.get(price)
    const totalQty = orders?.reduce((sum, o) => sum + (o.qty - o.filledQty), 0) ?? 0
    return [price, totalQty]
  })

  const asks: [number, number][] = touchedAskPrices.map(price => {
    const orders = orderbook.asks.get(price)
    const totalQty = orders?.reduce((sum, o) => sum + (o.qty - o.filledQty), 0) ?? 0
    return [price, totalQty]
  })

  return {
    symbol,
    firstUpdateId: prevUpdateId + 1,
    finalUpdateId,
    prevUpdateId,
    bids,
    asks
  }
}
