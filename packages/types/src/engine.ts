type OrderType = "market" | "limit";
type Side = "buy" | "sell";

export type EngineCommandType =
  | "create_order"
  | "cancel_order"
  | "add_balance"
  | "get_balance"
  | "get_depth"
  | "update_index_price"
  | "create_market"

export type createOrderType = {
  orderType: OrderType,
  side: Side,
  price: number,
  qty: number,
  leverage: number,
} | {
  orderType: OrderType,
  side: Side,
  price: number,
  qty: number,
  leverage: number,
  slippageBps: number
}

export type cancelOrderType = {
  userId: string,
  orderId: string
}

export interface EngineResponse {
  correlationId: string
  ok: boolean
  data?: unknown
  error?: string
}

export interface addBalanceType {
  userId: string,
  amount: number
}

export type EnginePayload =
  | createOrderType
  | cancelOrderType
  | addBalanceType


export interface EngineRequest {
  correlationId: string,
  type: EngineCommandType,
  payload: EnginePayload,
  responseQueue: string
}
