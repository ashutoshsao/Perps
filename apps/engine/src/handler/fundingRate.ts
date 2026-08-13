import { FundingRateResponse, FundingRateSnapshot, Settlement } from "@repo/types";
import { FUNDING_RATE_ACCOUMILATOR, INDEX_PRICES, LAST_FUNDING, ORDERBOOKS, POSITIONS } from "../engine-store";
import { currentFundingRate } from "../helper/predictedFunding";

export function fundingRate(streamMsgId: string): FundingRateResponse {

  let rates: FundingRateSnapshot[] = [];
  let settlements: Settlement[] = [];
  const settledAt = parseInt(`${streamMsgId.split('-')[0]}`);

  for (const [symbol] of ORDERBOOKS) {
    const indexPrice = INDEX_PRICES.get(symbol);
    if (!indexPrice) continue;

    const { rate } = currentFundingRate(symbol);
    rates.push({ symbol, rate, settledAt });

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
        symbol, userId, rate, payment, marginAfter: position.margin, liquidationPriceAfter: position.liquidationPrice, settledAt
      })

    }
    FUNDING_RATE_ACCOUMILATOR.set(symbol, { sumPremium: 0, samples: 0 })
    LAST_FUNDING.set(symbol, rate)
  }
  return { rates, settlements };
}
