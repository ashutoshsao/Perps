import { LiquidationEvent, Position } from "@repo/types";
import { createOrder } from "../handler/createOrder";
import { adl } from "./adl";

export function liquidatePosition(userId: string, position: Position, streamMsgId: string): LiquidationEvent[] {
  const order = createOrder({
    userId,
    symbol: position.symbol,
    side: position.positionSide === "long" ? "sell" : "buy",
    orderType: "market",
    qty: position.qty,
    leverage: Math.floor((position.averagePrice * position.qty) / position.margin),
    slippageBps: 10000,
  }, streamMsgId, `liq-${position.symbol}-${userId}`)
  if (order.fills.length > 0) {
    return [{ ...order, reason: "liquidation" }];
  } else {
    // no liquidity — ADL needed
    return adl(position, streamMsgId);
  }
}
