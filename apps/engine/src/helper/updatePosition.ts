import { updatePositionPayload } from "@repo/types";
import { POSITIONS } from "../engine-store";

export function updatePosition(payload: updatePositionPayload) {
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
      margin: payload.fillMargin
    };
    positions.set(payload.symbol, symbolPosition);
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
  } else {
    //opposite side position update, three cases
    //1 less then curr qty - decrease position
    if (payload.fillQty < symbolPosition.qty) {
      let newQty = symbolPosition.qty - payload.fillQty;
      let proportionalMargin = symbolPosition.margin * (payload.fillQty / symbolPosition.qty);
      let newMargin = symbolPosition.margin - proportionalMargin;
      let newLiqPrice = payload.positionSide === "long"
        ? symbolPosition.averagePrice - Math.floor(newMargin / newQty)
        : symbolPosition.averagePrice + Math.floor(newMargin / newQty)
      //update position
      symbolPosition.qty = newQty;
      symbolPosition.margin = newMargin;
      symbolPosition.liquidationPrice = newLiqPrice;
    }
    //2 equal to curr qty - close position
    else if (payload.fillQty === symbolPosition.qty) {
      positions.delete(payload.symbol);
    }
    //3 more then curr qty - close curr position and open opposite
    else {
      const remainingQty = payload.fillQty - symbolPosition.qty;
      const newLiqPrice = payload.positionSide === "long"
        ? payload.fillPrice - Math.floor(payload.fillMargin / payload.fillQty)
        : payload.fillPrice + Math.floor(payload.fillMargin / payload.fillQty);
      symbolPosition.positionSide = payload.positionSide;
      symbolPosition.qty = remainingQty;
      symbolPosition.averagePrice = payload.fillPrice;
      symbolPosition.liquidationPrice = newLiqPrice;
      symbolPosition.margin = payload.fillMargin;
    }
  }
}
