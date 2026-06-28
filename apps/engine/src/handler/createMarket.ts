import { CreateMarketPayload } from "@repo/types";
import { MARKET_UPDATE_ID, MARKETS, ORDERBOOKS } from "../engine-store";
import BTree from "sorted-btree";

export function createMarket(payload: CreateMarketPayload) {
  const { marketId, symbol, maxLeverage, minQty } = payload;
  let existingMarket = MARKETS.get(symbol);
  if (existingMarket) throw new Error(`market ${symbol} already exists`)
  MARKET_UPDATE_ID.set(symbol, 0);
  MARKETS.set(symbol, {
    marketId,
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
