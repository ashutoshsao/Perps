import { Balance, Fill, Market, Orderbook, OrderRecord, Position } from "@repo/types"
export const ORDERBOOKS = new Map<string, Orderbook>();
export const ORDERS = new Map<string, OrderRecord>();
export const POSITIONS = new Map<string, Map<string, Position>>();
export const BALANCES = new Map<string, Map<string, Balance>>();
export const FILLS = new Map<string, Fill[]>();
export const MARKETS = new Map<string, Market>();
export const INDEX_PRICES = new Map<string, number>()
export const MARKET_UPDATE_IDS = new Map<string, number>()
export const FUNDING_RATE_ACCOUMILATOR = new Map<string, { sumPremium: number, samples: number }>
export const MARK_PRICE_EWMA = new Map<string, number>
export const LAST_FUNDING = new Map<string, number>
