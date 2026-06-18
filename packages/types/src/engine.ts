import BTree from "sorted-btree";

type OrderType = "market" | "limit";
type Side = "buy" | "sell";
type OrderStatus = "open" | "filled" | "partially_filled" | "cancelled"
type PositionSide = "long" | "short";

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

export type GetDepthPayload = {
  symbol: string
}

export type Market = {
  maxLeverage: number,
  minQty: number,
  symbol: string,
}

export type CreateMarketPayload = {
  symbol: string,
  minQty: number,
  maxLeverage: number
}

export type RestingOrder = {
  userId: string,
  orderId: string,
  status: OrderStatus,
  qty: number,
  filledQty: number,
  margin: number,
  leverage: number,
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
}

export type Position = {
  userId: string,
  positionSide: PositionSide,
  liquidationPrice: number
  symbol: string,
  qty: number,
  margin: number,
  averagePrice: number,
}


export type updatePositionPayload = {
  userId: string,
  symbol: string,
  positionSide: PositionSide,
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
  orderType: "limit",
  side: Side,
  price: number,
  qty: number,
  leverage: number,
} | {
  userId: string,
  symbol: string
  orderType: "market",
  side: Side,
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
  type: EngineCommandType
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
  | CreateMarketPayload
  | getBalancePayload;


export interface EngineRequest {
  correlationId: string,
  type: EngineCommandType,
  payload: EnginePayload,
  responseQueue: string
}
