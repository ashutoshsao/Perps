import type { Market } from "../api/types";
import type { ChartInterval } from "./types";

export const AUTH_TOKEN_KEY = "perps.auth.token";
export const slippagePresetPercents = [0.1, 0.5, 1, 2, 5];
export const primaryMarketOrder = ["BTC", "ETH", "SOL"];
export const fallbackMarkets: Market[] = [
  { id: "btc", symbol: "BTC", imageUrl: "", maxLeverage: 10, minQty: 1 },
  { id: "eth", symbol: "ETH", imageUrl: "", maxLeverage: 10, minQty: 1 },
  { id: "sol", symbol: "SOL", imageUrl: "", maxLeverage: 10, minQty: 1 },
];
export const chartIntervals: ChartInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
