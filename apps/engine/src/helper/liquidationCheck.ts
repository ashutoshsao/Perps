import { POSITIONS } from "../engine-store";
import { liquidatePosition } from "./liquidate";

export function liquidationCheck(symbol: string, price: number, streamMsgId: string) {
  for (const [userId, userPositions] of POSITIONS) {
    const position = userPositions.get(symbol)
    if (!position) continue
    const isLiquidate = position.positionSide === "long"
      ? price <= position.liquidationPrice
      : price >= position.liquidationPrice
    if (isLiquidate) liquidatePosition(userId, position, streamMsgId);
  }
}
