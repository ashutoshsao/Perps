import BTree from "sorted-btree";

type OrderType = "market" | "limit";
type Side = "buy" | "sell";
type OrderStatus = "open" | "filled" | "partially_filled" | "cancelled"
export type EngineCommandType =
  | "create_order"
  | "cancel_order"
  | "add_balance"
  | "get_balance"
  | "get_depth"
  | "update_index_price"
  | "create_market"

export type updateIndexPricePayload = {
  symbol: string,
  price: number
}

export type RestingOrder = {
  userId: string,
  qty: number,
  filledQty: number,
  margin: number,
  leverage: number,
  createdAt: number,
  updatedAt: number
}

export type Fill = {
  fillId: string,
  makerUserId: string,
  takerUserId: string,
  makerOrderId: string,
  takerOrderId: string,
  makerSide: Side,
  qty: number,
  price: number,
  createdAt: number,
  symbol: string
}

export type OrderRecord = {
  orderId: string,
  side: Side,
  orderType: OrderType,
  status: OrderStatus
  userId: string,
  symbol: string,
  qty: number,
  filledQty: number,
  margin: number,
  leverage: number,
  price: number,
  fills: Fill[]
  createdAt: number,
  updatedAt: number
}

export type Position = {
  userId: string,
  symbol: string,
  qty: number,
  leverage: number,
  margin: number,
  averagePrice: number,
  createdAt: number,
  updatedAt: number
}

export type updatePositionPayload = {
  userId: string,
  symbol: string,
  side: Side,
  fillQty: number,
  fillPrice: number,
  fillMargin: number,
  leverage: number
}
export type Balance = {
  available: number,
  locked: number
}

export type Orderbook = {
  asks: BTree<number, RestingOrder[]>,
  bids: BTree<number, RestingOrder[]>,
  lastTradedPrice: number
}


export type createOrderPayload = {
  userId: string,
  symbol: string
  orderType: OrderType,
  side: "limit",
  price: number,
  qty: number,
  leverage: number,
} | {
  userId: string,
  symbol: string
  orderType: OrderType,
  side: "market",
  price: number,
  qty: number,
  leverage: number,
  slippageBps: number
}

export type getBalancePayload = {
  userId: string,
}

export type cancelOrderPayload = {
  userId: string,
  orderId: string
}

export interface EngineResponse {
  correlationId: string
  ok: boolean
  data?: unknown
  error?: string
  globalEvent?: boolean
}

export interface addBalancePayload {
  userId: string,
  amount: number
}

export type EnginePayload =
  | createOrderPayload
  | cancelOrderPayload
  | addBalancePayload


export interface EngineRequest {
  correlationId: string,
  type: EngineCommandType,
  payload: EnginePayload,
  responseQueue: string
}
