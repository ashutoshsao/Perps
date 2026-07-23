import { Env, MarketSpec } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type BotAuth = { username: string; token: string; userId: string };

type OrderPayload =
  | { orderType: "limit"; side: "buy" | "sell"; symbol: string; price: number; qty: number; leverage: number }
  | { orderType: "market"; side: "buy" | "sell"; symbol: string; qty: number; leverage: number; slippageBps: number };

export type OrderResult = {
  order: { orderId: string; status: string; qty: number; filledQty: number; price: number };
};

async function request<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const { method = "GET", token, body, headers = {} } = options;
  const response = await fetch(`${Env.apiUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = (json.message ?? json.error ?? `HTTP ${response.status}`) as string;
    throw new ApiError(response.status, message);
  }
  return json as T;
}

function decodeUserId(token: string): string {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("malformed jwt");
  return (JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId: string }).userId;
}

/** Sign in as the bot, creating the account on first run. */
export async function ensureUser(username: string, name: string): Promise<BotAuth> {
  try {
    const { token } = await request<{ token: string }>("/signin", {
      method: "POST",
      body: { username, password: Env.botPassword },
    });
    return { username, token, userId: decodeUserId(token) };
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) throw err;
  }
  const { token } = await request<{ token: string }>("/signup", {
    method: "POST",
    body: { username, name, password: Env.botPassword },
  });
  return { username, token, userId: decodeUserId(token) };
}

export const api = {
  ping: async () => {
    const response = await fetch(`${Env.apiUrl}/markets`);
    if (!response.ok) throw new ApiError(response.status, "markets endpoint not ready");
  },

  createMarket: (auth: BotAuth, spec: MarketSpec) =>
    request("/market", {
      method: "POST",
      token: auth.token,
      headers: { token: Env.adminSecret },
      body: {
        symbol: spec.symbol,
        imageUrl: spec.imageUrl,
        maxLeverage: spec.maxLeverage,
        minQty: spec.minQty,
      },
    }),

  onramp: (auth: BotAuth, amountCents: number) =>
    request("/onramp", { method: "POST", token: auth.token, body: { amount: amountCents } }),

  balance: (auth: BotAuth) =>
    request<{ response: { available: number; locked: number } }>("/balance", { token: auth.token }).then(
      (r) => r.response,
    ),

  placeOrder: (auth: BotAuth, payload: OrderPayload) =>
    request<OrderResult>("/order", { method: "POST", token: auth.token, body: payload }),

  cancelOrder: (auth: BotAuth, orderId: string) =>
    request(`/order/${orderId}`, { method: "DELETE", token: auth.token }),

  openOrders: (auth: BotAuth) =>
    request<{ orders: { id: string; status: string }[] }>("/orders", { token: auth.token }).then((r) =>
      r.orders.filter((o) => o.status === "open" || o.status === "partially_filled"),
    ),
};
