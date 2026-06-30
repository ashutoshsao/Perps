export type Route = "trade" | "wallet" | "admin" | "signin" | "signup";
export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market";
export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export type AccountTab = "positions" | "open" | "history" | "fills";
export type MarketDataTab = "book" | "trades";
export type DerivedPosition = {
  symbol: string;
  side: "long" | "short";
  qty: number;
  averagePrice: number;
};
