import { Position } from "@repo/types";
import { createOrder } from "../handler/createOrder";
import { adl } from "./adl";

export function liquidatePosition(userId: string, position: Position) {
  const order = createOrder({
    userId,
    symbol: position.symbol,
    side: position.positionSide === "long" ? "sell" : "buy",
    orderType: "market",
    qty: position.qty,
    leverage: Math.floor((position.averagePrice * position.qty) / position.margin),
    slippageBps: 10000,
  })

  if (order.fills.length === 0) {
    // no liquidity — ADL needed
    adl(position);
    return
  }
}
