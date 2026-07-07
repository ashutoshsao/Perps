import { createOrderPayload, OrderRecord, RestingOrder } from "@repo/types";
import { MARKETS, ORDERBOOKS, ORDERS } from "../engine-store";
import { fetchBalance } from "../helper/fetchBalance";
import { matchOrder } from "../helper/matchOrder";
import { updatePosition } from "../helper/updatePosition";
import { getDepthDiff } from "../helper/getDepthDiff";

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
      Math.floor(orderbook.asks.minKey()! * (1 + payload.slippageBps / 10000)) :
      Math.floor(orderbook.bids.maxKey()! * (1 - payload.slippageBps / 10000))

  if (orderType === "market") {
    const bestPrice = side === "buy" ? orderbook.asks.minKey()! : orderbook.bids.maxKey()!;
    const crossesBestPrice = side === "buy" ? bestPrice <= limitPrice : bestPrice >= limitPrice;
    if (!crossesBestPrice) throw new Error("no liquidity within slippage");
  }

  //check margin for that market;
  const market = MARKETS.get(symbol);
  if (!market) throw new Error(`market ${symbol} doesn't exist`);
  if (leverage > market.maxLeverage) throw new Error(`maximum leverage allowed for ${symbol} is ${market.maxLeverage}`)
  if (qty < market.minQty) throw new Error(`min qty is ${market.minQty}`)

  let margin = Math.floor(
    Number((BigInt(qty) * BigInt(limitPrice))
      / BigInt(leverage)
    ));

  //check balance
  const usdBalance = fetchBalance(userId, "USD");
  if (!usdBalance) throw new Error("usd Balance not found");
  if (margin > usdBalance.available) throw new Error("Insufficient Balance");

  usdBalance.available -= margin;
  usdBalance.locked += margin;

  const order: OrderRecord = {
    orderId: crypto.randomUUID(),
    marketId: market.marketId,
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

  const { fills, remainingQty, totalCost, touchedAskPrices, touchedBidPrices } = matchOrder(limitPrice, order);

  for (const fill of fills) {

    //order record Update;
    order.filledQty += fill.qty;
    order.fills.push(fill);

    //update position of maker
    updatePosition({
      userId: fill.takerUserId,
      symbol: order.symbol,
      positionSide: order.side === "buy" ? "long" : "short",
      fillQty: fill.qty,
      fillPrice: fill.price,
      fillMargin: Math.floor(Number(BigInt(fill.qty) * BigInt(fill.price) / BigInt(order.leverage))),
      leverage: order.leverage,
    })

    //makerOrder update and position update
    const makerOrder = ORDERS.get(fill.makerOrderId);
    if (!makerOrder) throw new Error("no maker order found");
    makerOrder.filledQty += fill.qty;
    makerOrder.fills.push(fill);

    //update makerOrder's status
    if (makerOrder.filledQty === makerOrder.qty) makerOrder.status = "filled"
    else if (makerOrder.filledQty > 0) makerOrder.status = "partially_filled"
    else makerOrder.status = "open"

    //update position of maker
    updatePosition({
      userId: fill.makerUserId,
      symbol: makerOrder.symbol,
      positionSide: makerOrder.side === "buy" ? "long" : "short",
      fillQty: fill.qty,
      fillPrice: fill.price,
      fillMargin: Math.floor(Number(BigInt(fill.qty) * BigInt(fill.price) / BigInt(makerOrder.leverage))),
      leverage: makerOrder.leverage,
    })

  }

  //taker order status update
  if (order.filledQty === order.qty) order.status = "filled"
  else if (order.filledQty > 0) order.status = "partially_filled"
  else order.status = "open"

  //handle remaining qty
  if (remainingQty > 0) {
    if (orderType === "limit") {
      //limit order remaining qty create resting order
      const restingOrder: RestingOrder = {
        userId: order.userId,
        orderId: order.orderId,
        qty: remainingQty,
        filledQty: 0,
        leverage: order.leverage,
        margin: Number(BigInt(limitPrice) * BigInt(remainingQty) / BigInt(order.leverage)),
        status: "open",
      }
      if (side === "buy") {
        let existing = orderbook.bids.get(limitPrice) ?? [];
        existing.push(restingOrder);
        orderbook.bids.set(limitPrice, existing);
      } else {
        let existing = orderbook.asks.get(limitPrice) ?? [];
        existing.push(restingOrder);
        orderbook.asks.set(limitPrice, existing);
      }
    } else {
      // market order refund
      const remainingMargin = Math.floor(Number(BigInt(remainingQty) * BigInt(limitPrice) / BigInt(leverage)))
      usdBalance.locked -= remainingMargin
      usdBalance.available += remainingMargin
    }
  }
  // return the delta of locked vs actual trade price
  const lockedForFill = Math.floor(Number(BigInt(order.filledQty) * BigInt(limitPrice) / BigInt(leverage)));
  const actualSpend = Math.floor(totalCost / leverage);
  const refund = lockedForFill - actualSpend;

  usdBalance.locked -= refund;
  usdBalance.available += refund;

  if (orderType === "limit" && remainingQty > 0) {
    if (side === "buy") touchedBidPrices.push(limitPrice)
    else touchedAskPrices.push(limitPrice)
  }

  const depthDiff = getDepthDiff(symbol, touchedBidPrices, touchedAskPrices)

  return {
    order,
    fills: order.fills,
    makerOrders: fills.map(f => ORDERS.get(f.makerOrderId)).filter((o): o is OrderRecord => o !== undefined),
    depthDiff,
  }
}
