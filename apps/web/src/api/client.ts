import type {
  AuthResponse,
  Balance,
  Candle,
  ClosedPositionRecord,
  CreateMarketPayload,
  Depth,
  FundingInfo,
  FundingSettlementRecord,
  Market,
  OrderMutationResponse,
  OrderPayload,
  Ticker,
  Trade,
  UserFill,
  UserOrder,
} from "./types";

const API_URL = import.meta.env?.VITE_API_URL ?? "/api";

type RequestOptions = {
  token?: string | null;
  adminToken?: string | null;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};

  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.adminToken) headers.token = options.adminToken;

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? data?.message ?? `Request failed: ${response.status}`);
  }

  return data as T;
}

export const api = {
  signin(payload: { username: string; password: string }) {
    return request<AuthResponse>("/signin", { method: "POST", body: payload });
  },
  signup(payload: { name?: string; username: string; password: string }) {
    return request<AuthResponse>("/signup", { method: "POST", body: payload });
  },
  getMarkets() {
    return request<{ markets: Market[] }>("/markets");
  },
  createMarket(token: string, adminToken: string, payload: CreateMarketPayload) {
    return request<{ marketId: string }>("/market", { method: "POST", token, adminToken, body: payload });
  },
  getTicker(symbol: string) {
    return request<Ticker>(`/ticker/${encodeURIComponent(symbol)}`);
  },
  getDepth(symbol: string) {
    return request<Depth>(`/depth/${encodeURIComponent(symbol)}`);
  },
  getKlines(symbol: string, interval = "1m") {
    return request<{ candles: Candle[] }>(`/klines/${encodeURIComponent(symbol)}?interval=${interval}`);
  },
  getTrades(symbol: string, limit = 50) {
    return request<{ trades: Trade[] }>(`/trades/${encodeURIComponent(symbol)}?limit=${limit}`);
  },
  getBalance(token: string) {
    return request<{ response: Balance }>("/balance", { token });
  },
  addBalance(token: string, amount: number) {
    return request<{ response: Balance }>("/onramp", { method: "POST", token, body: { amount } });
  },
  getOrders(token: string, limit = 200) {
    return request<{ orders: UserOrder[]; nextCursor: string | null }>(`/orders?limit=${limit}`, { token });
  },
  getFills(token: string, limit = 200) {
    return request<{ fills: UserFill[]; nextCursor: string | null }>(`/fills?limit=${limit}`, { token });
  },
  placeOrder(token: string, payload: OrderPayload) {
    return request<OrderMutationResponse>("/order", { method: "POST", token, body: payload });
  },
  cancelOrder(token: string, orderId: string) {
    return request<OrderMutationResponse>(`/order/${encodeURIComponent(orderId)}`, { method: "DELETE", token });
  },
  getFundingInfo(symbol: string) {
    return request<FundingInfo>(`/funding/${encodeURIComponent(symbol)}`);
  },
  getFundingHistory(token: string, params?: { limit?: number; cursor?: string }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.cursor) qs.set("cursor", params.cursor);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ settlements: FundingSettlementRecord[]; nextCursor: string | null }>(`/funding/history${suffix}`, { token });
  },
  getPositionHistory(token: string, params?: { symbol?: string; limit?: number; cursor?: string }) {
    const qs = new URLSearchParams();
    if (params?.symbol) qs.set("symbol", params.symbol);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.cursor) qs.set("cursor", params.cursor);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ positions: ClosedPositionRecord[]; nextCursor: string | null }>(`/positions/history${suffix}`, { token });
  },
};
