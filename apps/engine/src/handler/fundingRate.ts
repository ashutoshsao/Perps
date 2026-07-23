import { Settlement } from "@repo/types";
import { FUNDING_RATE_ACCOUMILATOR, INDEX_PRICES, LAST_FUNDING, ORDERBOOKS, POSITIONS } from "../engine-store";

export function fundingRate(streamMsgId: string) {

  let settlements: Settlement[] = [];

  for (const [symbol, orderbook] of ORDERBOOKS) {
    const indexPrice = INDEX_PRICES.get(symbol);
    if (!indexPrice) continue;

    const acc = FUNDING_RATE_ACCOUMILATOR.get(symbol)
    let rate = acc && acc.samples > 0 ? acc.sumPremium / acc.samples : (LAST_FUNDING.get(symbol) ?? 0);
    rate = Math.max(-0.0075, Math.min(0.0075, rate));

    for (const [userId, userPositions] of POSITIONS) {
      const position = userPositions.get(symbol);
      if (!position) continue;

      const notionalValue = position.qty * indexPrice;
      const payment = Math.floor(notionalValue * rate);

      if (position.positionSide === "long") {
        position.margin -= payment;
      } else {
        position.margin += payment;
      }

      position.liquidationPrice = position.positionSide === "long"
        ? position.averagePrice - Math.floor(position.margin / position.qty)
        : position.averagePrice + Math.floor(position.margin / position.qty)

      settlements.push({
        symbol, userId, rate, payment, marginAfter: position.margin, liquidationPriceAfter: position.liquidationPrice, settledAt: parseInt(`${streamMsgId.split('-')[0]}`)
      })

    }
    FUNDING_RATE_ACCOUMILATOR.set(symbol, { sumPremium: 0, samples: 0 })
    LAST_FUNDING.set(symbol, rate)
  }
  return { settlements };
}
