import { INDEX_PRICES, ORDERBOOKS, POSITIONS } from "../engine-store";

export function fundingRate() {
  for (const [symbol, orderbook] of ORDERBOOKS) {
    const indexPrice = INDEX_PRICES.get(symbol);
    if (!indexPrice) continue;

    const rate = (orderbook.lastTradedPrice - indexPrice) / indexPrice;

    for (const [_userId, userPositions] of POSITIONS) {
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
    }
    return null;
  }
}
