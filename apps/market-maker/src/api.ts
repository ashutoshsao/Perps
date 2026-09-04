import { Env, MarketSpec } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type BotAuth = { username: string; token: string; refreshToken: string; userId: string };

type OrderPayload =
  | { orderType: "limit"; side: "buy" | "sell"; symbol: string; price: number; qty: number; leverage: number }
  | { orderType: "market"; side: "buy" | "sell"; symbol: string; qty: number; leverage: number; slippageBps: number };

export type OrderResult = {
  order: { orderId: string; status: string; qty: number; filledQty: number; price: number };
};

type RequestOptions = { method?: string; auth?: BotAuth; body?: unknown; headers?: Record<string, string> };

async function rawRequest(path: string, options: RequestOptions): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const { method = "GET", auth, body, headers = {} } = options;
  const response = await fetch(`${Env.apiUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: `Bearer ${auth.token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, json };
}

// mutates auth.token in place — every caller holds the same BotAuth object
// reference (quoter/taker/degen), so this refresh is immediately visible to
// every subsequent call, including a websocket reconnect picking it up later
async function refreshBotToken(auth: BotAuth): Promise<boolean> {
  const { ok, json } = await rawRequest("/refresh", { method: "POST", body: { refreshToken: auth.refreshToken } });
  if (!ok) return false;
  auth.token = json.token as string;
  return true;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { ok, status, json } = await rawRequest(path, options);
  if (!ok) {
    if (!isRetry && options.auth && status === 401 && json.code === "TOKEN_EXPIRED") {
      const refreshed = await refreshBotToken(options.auth);
      if (refreshed) return request<T>(path, options, true);
    }
    const message = (json.message ?? json.error ?? `HTTP ${status}`) as string;
    throw new ApiError(status, message);
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
    const { token, refreshToken } = await request<{ token: string; refreshToken: string }>("/signin", {
      method: "POST",
      body: { username, password: Env.botPassword },
    });
    return { username, token, refreshToken, userId: decodeUserId(token) };
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) throw err;
  }
  const { token, refreshToken } = await request<{ token: string; refreshToken: string }>("/signup", {
    method: "POST",
    body: { username, name, password: Env.botPassword },
  });
  return { username, token, refreshToken, userId: decodeUserId(token) };
}

export const api = {
  ping: async () => {
    const response = await fetch(`${Env.apiUrl}/markets`);
    if (!response.ok) throw new ApiError(response.status, "markets endpoint not ready");
  },

  createMarket: (auth: BotAuth, spec: MarketSpec) =>
    request("/market", {
      method: "POST",
      auth,
      headers: { token: Env.adminSecret },
      body: {
        symbol: spec.symbol,
        imageUrl: spec.imageUrl,
        maxLeverage: spec.maxLeverage,
        minQty: spec.minQty,
      },
    }),

  onramp: (auth: BotAuth, amountCents: number) =>
    request("/onramp", { method: "POST", auth, body: { amount: amountCents } }),

  balance: (auth: BotAuth) =>
    request<{ response: { available: number; locked: number } }>("/balance", { auth }).then(
      (r) => r.response,
    ),

  placeOrder: (auth: BotAuth, payload: OrderPayload) =>
    request<OrderResult>("/order", { method: "POST", auth, body: payload }),

  cancelOrder: (auth: BotAuth, orderId: string) =>
    request(`/order/${orderId}`, { method: "DELETE", auth }),

  ordersPage: (auth: BotAuth, cursor?: string) =>
    request<{ orders: { id: string; status: string }[]; nextCursor: string | null }>(
      `/orders?limit=200${cursor ? `&cursor=${cursor}` : ""}`,
      { auth },
    ),

  /** walks every page — a single page (200) isn't enough to find all open orders once the count exceeds that */
  openOrders: async (auth: BotAuth) => {
    const open: { id: string; status: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await api.ordersPage(auth, cursor);
      open.push(...page.orders.filter((o) => o.status === "open" || o.status === "partially_filled"));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return open;
  },
};
