import type { AuthResponse, Balance, Candle, Depth, Market, OrderMutationResponse, OrderPayload, Ticker, Trade, UserFill, UserOrder } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

type RequestOptions = {
  token?: string | null;
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
  getOrders(token: string) {
    return request<{ orders: UserOrder[] }>("/orders", { token });
  },
  getOpenOrders(token: string) {
    return request<{ orders: UserOrder[] }>("/orders/open", { token });
  },
  getOrderHistory(token: string) {
    return request<{ orders: UserOrder[] }>("/orders/history", { token });
  },
  getFills(token: string) {
    return request<{ fills: UserFill[] }>("/fills", { token });
  },
  placeOrder(token: string, payload: OrderPayload) {
    return request<OrderMutationResponse>("/order", { method: "POST", token, body: payload });
  },
  cancelOrder(token: string, orderId: string) {
    return request<OrderMutationResponse>(`/order/${encodeURIComponent(orderId)}`, { method: "DELETE", token });
  },
};
