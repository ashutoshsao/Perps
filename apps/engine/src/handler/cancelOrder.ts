import { cancelOrderPayload } from "@repo/types";
import { ORDERBOOKS, ORDERS } from "../engine-store";
import { fetchBalance } from "../helper/fetchBalance";

export function cancelOrder(payload: cancelOrderPayload) {
  const { orderId, userId } = payload;
  const order = ORDERS.get(orderId);
  //check order exist
  if (!order) throw new Error("Order doesn't exist");
  //check if user is authorized
  if (order.userId !== userId) throw new Error("Unauthorized requet");
  //check if order is cancellable
  if (order.status === "filled" || order.status === "cancelled") throw new Error(`Order status ${order.status} can't be cancelled`);
  //resting order find and remove
  const orderbook = ORDERBOOKS.get(order.symbol);
  if (!orderbook) throw new Error(`market ${order.symbol} doesn exist`);
  let tree = order.side === "buy" ? orderbook.bids : orderbook.asks;
  let priceBracket = tree.get(order.price);
  if (!priceBracket) throw new Error("price priceBracket doesn't exist");
  const remaining = priceBracket.filter(o => o.orderId !== orderId)
  if (remaining.length === priceBracket.length) throw new Error("resting order not found")
  if (remaining.length === 0) tree.delete(order.price)
  else tree.set(order.price, remaining)

  //refund locked amount to available
  const remainingQty = order.qty - order.filledQty;
  const usdBalance = fetchBalance(userId, "USD");
  const refund = Math.floor(Number(BigInt(remainingQty) * BigInt(order.price) / BigInt(order.leverage)));
  usdBalance.locked -= refund;
  usdBalance.available += refund;

  //order status update
  order.status = "cancelled";

  return order;
}
