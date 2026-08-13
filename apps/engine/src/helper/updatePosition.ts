import { PositionClose, updatePositionPayload } from "@repo/types";
import { POSITIONS } from "../engine-store";

function realizedPnl(
  positionSide: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  qty: number
): number {
  const diff = BigInt(exitPrice) - BigInt(entryPrice);
  const signed = positionSide === "long" ? diff : -diff;
  return Number(signed * BigInt(qty));
}

export function updatePosition(payload: updatePositionPayload): PositionClose | null {
  let positions = POSITIONS.get(payload.userId)
  if (!positions) {
    positions = new Map();
    POSITIONS.set(payload.userId, positions);
  };
  let symbolPosition = positions.get(payload.symbol);
  //case no position yet
  if (!symbolPosition) {
    const liquidationPrice = payload.positionSide === "long"
      ? payload.fillPrice - Math.floor(payload.fillMargin / payload.fillQty)
      : payload.fillPrice + Math.floor(payload.fillMargin / payload.fillQty);
    symbolPosition = {
      userId: payload.userId,
      positionSide: payload.positionSide,
      qty: payload.fillQty,
      symbol: payload.symbol,
      liquidationPrice: liquidationPrice,
      averagePrice: payload.fillPrice,
      margin: payload.fillMargin,
      openedAt: payload.fillCreatedAt,
    };
    positions.set(payload.symbol, symbolPosition);
    return null;
  }
  else if (symbolPosition.positionSide === payload.positionSide) {
    //same side position increases
    let newQty = symbolPosition.qty + payload.fillQty;
    const newAvgPrice = Math.floor(
      (symbolPosition.qty * symbolPosition.averagePrice + payload.fillQty * payload.fillPrice) / newQty
    )
    let newMargin = symbolPosition.margin + payload.fillMargin;
    let newLiquidationPrice = payload.positionSide === "long"
      ? newAvgPrice - Math.floor(newMargin / newQty)
      : newAvgPrice + Math.floor(newMargin / newQty);

    //update position
    symbolPosition.qty = newQty;
    symbolPosition.averagePrice = newAvgPrice;
    symbolPosition.margin = newMargin;
    symbolPosition.liquidationPrice = newLiquidationPrice;
    return null;
  } else {
    //opposite side position update, three cases
    //1 less then curr qty - decrease position
    if (payload.fillQty < symbolPosition.qty) {
      const oldMargin = symbolPosition.margin;
      const oldAveragePrice = symbolPosition.averagePrice;
      const oldOpenedAt = symbolPosition.openedAt;

      let newQty = symbolPosition.qty - payload.fillQty;
      let proportionalMargin = Math.floor(oldMargin * payload.fillQty / symbolPosition.qty);
      let newMargin = oldMargin - proportionalMargin;
      let newLiqPrice = payload.positionSide === "long"
        ? symbolPosition.averagePrice - Math.floor(newMargin / newQty)
        : symbolPosition.averagePrice + Math.floor(newMargin / newQty)
      //update position
      symbolPosition.qty = newQty;
      symbolPosition.margin = newMargin;
      symbolPosition.liquidationPrice = newLiqPrice;

      return {
        userId: payload.userId,
        symbol: payload.symbol,
        positionSide: symbolPosition.positionSide,
        closeType: "reduce",
        entryPrice: oldAveragePrice,
        exitPrice: payload.fillPrice,
        qty: payload.fillQty,
        realizedPnl: realizedPnl(symbolPosition.positionSide, oldAveragePrice, payload.fillPrice, payload.fillQty),
        marginReleased: proportionalMargin,
        openedAt: oldOpenedAt,
        closedAt: payload.fillCreatedAt,
      };
    }
    //2 equal to curr qty - close position
    else if (payload.fillQty === symbolPosition.qty) {
      const oldMargin = symbolPosition.margin;
      const oldAveragePrice = symbolPosition.averagePrice;
      const oldPositionSide = symbolPosition.positionSide;
      const oldOpenedAt = symbolPosition.openedAt;

      positions.delete(payload.symbol);

      return {
        userId: payload.userId,
        symbol: payload.symbol,
        positionSide: oldPositionSide,
        closeType: "close",
        entryPrice: oldAveragePrice,
        exitPrice: payload.fillPrice,
        qty: payload.fillQty,
        realizedPnl: realizedPnl(oldPositionSide, oldAveragePrice, payload.fillPrice, payload.fillQty),
        marginReleased: oldMargin,
        openedAt: oldOpenedAt,
        closedAt: payload.fillCreatedAt,
      };
    }
    //3 more then curr qty - close curr position and open opposite
    else {
      const oldMargin = symbolPosition.margin;
      const oldAveragePrice = symbolPosition.averagePrice;
      const oldPositionSide = symbolPosition.positionSide;
      const oldQty = symbolPosition.qty;
      const oldOpenedAt = symbolPosition.openedAt;

      const remainingQty = payload.fillQty - symbolPosition.qty;
      const newLiqPrice = payload.positionSide === "long"
        ? payload.fillPrice - Math.floor(payload.fillMargin / payload.fillQty)
        : payload.fillPrice + Math.floor(payload.fillMargin / payload.fillQty);
      symbolPosition.positionSide = payload.positionSide;
      symbolPosition.qty = remainingQty;
      symbolPosition.averagePrice = payload.fillPrice;
      symbolPosition.liquidationPrice = newLiqPrice;
      symbolPosition.margin = payload.fillMargin;
      symbolPosition.openedAt = payload.fillCreatedAt;

      return {
        userId: payload.userId,
        symbol: payload.symbol,
        positionSide: oldPositionSide,
        closeType: "flip",
        entryPrice: oldAveragePrice,
        exitPrice: payload.fillPrice,
        qty: oldQty,
        realizedPnl: realizedPnl(oldPositionSide, oldAveragePrice, payload.fillPrice, oldQty),
        marginReleased: oldMargin,
        openedAt: oldOpenedAt,
        closedAt: payload.fillCreatedAt,
      };
    }
  }
}
