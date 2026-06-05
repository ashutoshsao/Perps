import { CreateMarketPayload } from "@repo/types";
import { MARKETS, ORDERBOOKS } from "../engine-store";
import BTree from "sorted-btree";

export function createMarket(payload: CreateMarketPayload) {
  const { symbol, maxLeverage, minQty } = payload;
  let existingMarket = MARKETS.get(symbol);
  if (existingMarket) throw new Error(`market ${symbol} already exists`)
  MARKETS.set(symbol, {
    maxLeverage,
    minQty,
    symbol
  })

  ORDERBOOKS.set(symbol, {
    bids: new BTree(),
    asks: new BTree(),
    lastTradedPrice: 0
  })

  return { maxLeverage, minQty, symbol };
}
