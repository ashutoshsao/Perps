import { createOrderPayload, OrderRecord } from "@repo/types";
import { ORDERBOOKS, ORDERS } from "../engine-store";
import { fetchBalance } from "../helper/fetchBalance";
import { matchOrder } from "../helper/matchOrder";

export function createOrder(payload: createOrderPayload) {
  const { userId, symbol, side, orderType, leverage, qty } = payload;

  let orderbook = ORDERBOOKS.get(symbol);
  if (!orderbook) throw new Error(`market ${symbol} doesn't exist`);
  // correct — only check what we need
  if (orderType === "market") {
    if (side === "buy" && orderbook.asks.size === 0) throw new Error("no liquidity on asks")
    if (side === "sell" && orderbook.bids.size === 0) throw new Error("no liquidity on bids")
  }
  const limitPrice = orderType === "limit" ? payload.price :
    side === "buy" ?
      Math.floor(orderbook.asks.minKey()! * ((1 + payload.slippageBps) / 10000)) :
      Math.floor(orderbook.bids.maxKey()! * ((1 - payload.slippageBps) / 10000))

  let margin = Math.floor(Number((BigInt(qty) * BigInt(limitPrice)) / BigInt(leverage)));

  //check balance
  const usdBalance = fetchBalance(userId, symbol);
  if (!usdBalance) throw new Error("usd Balance not found");
  if (margin > usdBalance.available) throw new Error("Insufficient Balance");

  usdBalance.available -= margin;
  usdBalance.locked += margin;

  const order: OrderRecord = {
    orderId: crypto.randomUUID(),
    userId,
    side,
    orderType,
    leverage,
    symbol,
    qty,
    filledQty: 0,
    price: limitPrice,
    margin,
    status: "open",
    fills: [],
  }
  ORDERS.set(order.orderId, order);

  const { fills, remainingQty, totalCost } = matchOrder(limitPrice, order);

  for (const fill of fills) {
    //order recordUpdate;
    order.filledQty += fill.qty;
    if (order.filledQty === order.qty) order.status = "filled"
    else if (order.filledQty < order.qty) order.status = "partially_filled"
    else order.status = "open"
    updatePosition({
      userId: fill.takerUserId,
      symbol: order.symbol,
      side: order.side === "buy" ? "long" : "short",
      fillQty: fill.qty,
      fillPrice: fill.price,
      fillMargin: Math.floor(Number(BigInt(fill.qty) * BigInt(fill.price) / BigInt(order.leverage))),
      leverage: order.leverage,
    })
    //makerOrder update and position update 
    const makerOrder = ORDERS.get(fill.makerOrderId);
  }

  //locked price update remaining qty add to available



}
