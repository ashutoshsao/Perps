import { UpdateIndexPriceResponse, updateIndexPricePayload } from "@repo/types";
import { FUNDING_RATE_ACCOUMILATOR, INDEX_PRICES, MARK_PRICE_EWMA, ORDERBOOKS } from "../engine-store";
import { liquidationCheck } from "../helper/liquidationCheck";

export function updateIndexPrice(payload: updateIndexPricePayload, streamMsgId: string): UpdateIndexPriceResponse {
  const { symbol, price } = payload;
  INDEX_PRICES.set(symbol, price);
  const orderbook = ORDERBOOKS.get(symbol);
  // lastTradedPrice is 0 until the first trade — feeding it into the EWMA
  // would decay the mark toward 0 and poison the funding premium accumulator
  if (orderbook && orderbook.lastTradedPrice > 0) {
    const prevMark = MARK_PRICE_EWMA.get(symbol) ?? price;
    const newMark = 0.15 * orderbook.lastTradedPrice + 0.85 * prevMark;
    MARK_PRICE_EWMA.set(symbol, newMark);
    const premium = (newMark - price) / price;

    const acc = FUNDING_RATE_ACCOUMILATOR.get(symbol) ?? { sumPremium: 0, samples: 0 };
    acc.sumPremium += premium;
    acc.samples += 1;
    FUNDING_RATE_ACCOUMILATOR.set(symbol, acc)
  }
  const events = liquidationCheck(symbol, price, streamMsgId);
  return {
    symbol,
    markPrice: Math.round(MARK_PRICE_EWMA.get(symbol) ?? price),
    events
  }
}
