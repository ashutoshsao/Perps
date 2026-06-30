export type Market = {
  id: string;
  symbol: string;
  imageUrl: string;
  maxLeverage: number;
  minQty: number;
};

export type CreateMarketPayload = {
  symbol: string;
  imageUrl: string;
  maxLeverage: number;
  minQty: number;
};

export type Depth = {
  symbol: string;
  asks: [number, number][];
  bids: [number, number][];
  lastUpdateId: number;
};

export type DepthDiff = {
  symbol: string;
  firstUpdateId: number;
  finalUpdateId: number;
  prevUpdateId: number;
  bids: [number, number][];
  asks: [number, number][];
};

export type MarkPrice = {
  symbol: string;
  price: number;
  time: number;
};

export type OrderPayload =
  | {
      orderType: "limit";
      side: "buy" | "sell";
      symbol: string;
      price: number;
      qty: number;
      leverage: number;
    }
  | {
      orderType: "market";
      side: "buy" | "sell";
      symbol: string;
      qty: number;
      leverage: number;
      slippageBps: number;
    };

export type Ticker = {
  symbol: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
  change: number | string;
  changePct: string;
};

export type Trade = {
  time: string;
  symbol: string;
  price: number | string;
  qty: number | string;
  side: "buy" | "sell";
};

export type TradeUpdate = {
  symbol: string;
  price: number;
  qty: number;
  side: "buy" | "sell";
  createdAt: number;
};

export type Candle = {
  bucket: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
};

export type Balance = {
  available: number;
  locked: number;
};

export type UserOrder = {
  id: string;
  userId: string;
  marketId: string;
  orderType: "limit" | "market";
  side: "buy" | "sell";
  qty: number;
  filledQty: number;
  price: number;
  leverage: number;
  initialMargin: number;
  status: "open" | "filled" | "partially_filled" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

export type EngineOrderRecord = {
  orderId: string;
  userId: string;
  marketId: string;
  symbol: string;
  orderType: "limit" | "market";
  side: "buy" | "sell";
  qty: number;
  filledQty: number;
  price: number;
  leverage: number;
  initialMargin: number;
  status: "open" | "filled" | "partially_filled" | "cancelled";
  margin: number;
  fills: unknown[];
};

export type EngineFill = {
  fillId: string;
  makerUserId: string;
  takerUserId: string;
  makerOrderId: string;
  takerOrderId: string;
  makerSide: "buy" | "sell";
  qty: number;
  price: number;
  symbol: string;
  createdAt: number;
};

export type OrderMutationResponse = {
  order: EngineOrderRecord;
  fills?: unknown[];
  makerOrders?: EngineOrderRecord[];
  depthDiff: DepthDiff;
};

export type UserFill = {
  id: string;
  qty: number;
  price: number;
  side: "buy" | "sell";
  makerSide: "buy" | "sell";
  symbol: string;
  makerUserId: string;
  takerUserId: string;
  makerOrderId: string;
  takerOrderId: string;
  marketId: string;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
};
