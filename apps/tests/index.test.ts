import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { EngineCommandType, EngineRequest } from "@repo/types";
import { handleCommand } from "../engine/src/controller/engine.controller";
import { BALANCES, FILLS, INDEX_PRICES, MARKETS, ORDERBOOKS, ORDERS, POSITIONS } from "../engine/src/engine-store";
import { newMarket, subscribedMarkets } from "../price-feeder/src/helper/newMarket";

const WORKSPACE_ROOT = `${import.meta.dir}/../..`;
const PORT = Number(process.env.TEST_API_PORT ?? "4210");
const BASE_URL = `http://127.0.0.1:${PORT}/api`;
const processes: Array<ReturnType<typeof Bun.spawn>> = [];
const processLogs: string[] = [];

const requiredEnv = ["DATABASE_URL", "REDIS_URL"] as const;

let username = "";
let password = "";
let authToken = "";
let marketSymbol = "";

function engineCommand(type: EngineCommandType, payload: unknown = {}) {
  return handleCommand({
    correlationId: crypto.randomUUID(),
    responseQueue: "test-response-queue",
    type,
    payload: payload as EngineRequest["payload"],
  }) as any;
}

function resetEngineStore() {
  BALANCES.clear();
  FILLS.clear();
  INDEX_PRICES.clear();
  MARKETS.clear();
  ORDERBOOKS.clear();
  ORDERS.clear();
  POSITIONS.clear();
}

async function loadEnvFile(path: string) {
  const file = Bun.file(path);
  if (!(await file.exists())) return;

  for (const line of (await file.text()).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

async function loadAppEnv() {
  await loadEnvFile(`${WORKSPACE_ROOT}/packages/db/.env`);
  await loadEnvFile(`${WORKSPACE_ROOT}/packages/redis/.env`);
  await loadEnvFile(`${WORKSPACE_ROOT}/apps/engine/.env`);
  await loadEnvFile(`${WORKSPACE_ROOT}/apps/api/.env`);
}

function appEnv() {
  return {
    ...process.env,
    PORT: String(PORT),
    JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret",
    ADMIN_SECRET: process.env.ADMIN_SECRET ?? "test-admin-secret",
  };
}

async function captureOutput(label: string, stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      processLogs.push(`[${label}] ${decoder.decode(value)}`);
    }
  } catch {
    // The streams close when the child processes are stopped in afterAll.
  }
}

function startProcess(label: string, args: string[]) {
  const process = Bun.spawn(args, {
    cwd: WORKSPACE_ROOT,
    env: appEnv(),
    stdout: "pipe",
    stderr: "pipe",
  });

  processes.push(process);
  void captureOutput(`${label}:stdout`, process.stdout);
  void captureOutput(`${label}:stderr`, process.stderr);
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `POST ${path} returned ${response.status} with a non-JSON body:\n${text}\n${processLogs.join("")}`,
      );
    }
  }

  return {
    response,
    json: json as any,
  };
}

async function waitForApi() {
  const deadline = Date.now() + 15_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const exited = processes.find((process) => process.exitCode !== null);
    if (exited) {
      throw new Error(`A test process exited with code ${exited.exitCode}\n${processLogs.join("")}`);
    }

    try {
      const { response } = await post("/signin", {});
      if (response.status === 400) return;
    } catch (error) {
      lastError = error;
    }

    await Bun.sleep(250);
  }

  throw new Error(`API did not become ready: ${String(lastError)}\n${processLogs.join("")}`);
}

beforeEach(() => {
  resetEngineStore();
});

describe("api integration", () => {
  beforeAll(async () => {
    await loadAppEnv();

    const missing = requiredEnv.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing test environment variables: ${missing.join(", ")}`);
    }

    startProcess("engine", ["bun", "apps/engine/index.ts"]);
    startProcess("api", ["bun", "apps/api/index.ts"]);
    await waitForApi();
  }, 20_000);

  afterAll(() => {
    for (const process of processes) process.kill();
  });

  describe("auth endpoints", () => {
    it("rejects signup without a username", async () => {
      const { response } = await post("/signup", { password: "password-123" });
      expect(response.status).toBe(400);
    });

    it("signs up a user", async () => {
      username = `test-${crypto.randomUUID()}@example.com`;
      password = "password-123";

      const { response, json } = await post("/signup", {
        name: "Test User",
        username,
        password,
      });

      expect(response.status).toBe(201);
      expect(json.token).toBeString();
    });

    it("rejects signin without a username", async () => {
      const { response } = await post("/signin", { password });
      expect(response.status).toBe(400);
    });

    it("rejects incorrect credentials", async () => {
      const { response } = await post("/signin", {
        username,
        password: "incorrect-password",
      });
      expect(response.status).toBe(401);
    });

    it("signs in with valid credentials", async () => {
      const { response, json } = await post("/signin", { username, password });

      expect(response.status).toBe(200);
      expect(json.token).toBeString();
      authToken = json.token;
    });
  });

  describe("order endpoints", () => {
    it("creates a market", async () => {
      marketSymbol = `TEST-${crypto.randomUUID().slice(0, 8).toUpperCase()}-USD`;
      const { response, json } = await post(
        "/market",
        {
          symbol: marketSymbol,
          imageUrl: "https://example.com/market.png",
          maxLeverage: 10,
          minQty: 1,
        },
        {
          authorization: `Bearer ${authToken}`,
          token: process.env.ADMIN_SECRET ?? "test-admin-secret",
        },
      );

      expect(response.status).toBe(201);
      expect(json.marketId).toBeString();
    });

    it("adds balance", async () => {
      const { response, json } = await post(
        "/onramp",
        { amount: 100_000 },
        { authorization: `Bearer ${authToken}` },
      );

      expect(response.status).toBe(200);
      expect(json.response.available).toBeGreaterThanOrEqual(100_000);
    });

    it("places an unmatched limit order", async () => {
      const { response, json } = await post(
        "/order",
        {
          orderType: "limit",
          side: "buy",
          price: 100,
          qty: 10,
          leverage: 1,
          symbol: marketSymbol,
        },
        { authorization: `Bearer ${authToken}` },
      );

      expect(response.status).toBe(200);
      expect(json.orderId).toBeString();
      expect(json.filledQty).toBe(0);
      expect(json.status).toBe("open");
    });
  });
});

describe("engine commands", () => {
  it("adds and fetches balances through the command dispatcher", () => {
    expect(
      engineCommand("add_balance", {
        userId: "balance-user",
        amount: 1_000,
      }),
    ).toEqual({ available: 1_000, locked: 0 });
    expect(
      engineCommand("add_balance", {
        userId: "balance-user",
        amount: 250,
      }),
    ).toEqual({ available: 1_250, locked: 0 });
    const fetchedBalance = engineCommand("get_balance", {
      userId: "balance-user",
    });
    expect(fetchedBalance).toEqual({ available: 1_250, locked: 0 });
  });

  it("creates a market and returns sorted depth for resting limit orders", () => {
    engineCommand("create_market", {
      symbol: "DEPTH-USD",
      maxLeverage: 5,
      minQty: 1,
    });
    expect(engineCommand("get_markets")).toEqual(["DEPTH-USD"]);
    engineCommand("add_balance", { userId: "maker-a", amount: 10_000 });
    engineCommand("add_balance", { userId: "maker-b", amount: 10_000 });

    engineCommand("create_order", {
      userId: "maker-a",
      symbol: "DEPTH-USD",
      orderType: "limit",
      side: "sell",
      price: 110,
      qty: 3,
      leverage: 1,
    });
    engineCommand("create_order", {
      userId: "maker-a",
      symbol: "DEPTH-USD",
      orderType: "limit",
      side: "sell",
      price: 100,
      qty: 2,
      leverage: 1,
    });
    engineCommand("create_order", {
      userId: "maker-b",
      symbol: "DEPTH-USD",
      orderType: "limit",
      side: "buy",
      price: 90,
      qty: 4,
      leverage: 1,
    });
    engineCommand("create_order", {
      userId: "maker-b",
      symbol: "DEPTH-USD",
      orderType: "limit",
      side: "buy",
      price: 95,
      qty: 1,
      leverage: 1,
    });

    expect(engineCommand("get_depth", { symbol: "DEPTH-USD" })).toEqual({
      symbol: "DEPTH-USD",
      asks: [
        [100, 2],
        [110, 3],
      ],
      bids: [
        [95, 1],
        [90, 4],
      ],
    });
  });

  it("matches a market buy against the best ask and updates both positions", () => {
    engineCommand("create_market", {
      symbol: "MATCH-USD",
      maxLeverage: 10,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "seller", amount: 10_000 });
    engineCommand("add_balance", { userId: "buyer", amount: 10_000 });

    const makerOrder = engineCommand("create_order", {
      userId: "seller",
      symbol: "MATCH-USD",
      orderType: "limit",
      side: "sell",
      price: 100,
      qty: 10,
      leverage: 1,
    });
    const takerOrder = engineCommand("create_order", {
      userId: "buyer",
      symbol: "MATCH-USD",
      orderType: "market",
      side: "buy",
      qty: 4,
      leverage: 1,
      slippageBps: 10_000,
    });

    expect(takerOrder.status).toBe("filled");
    expect(takerOrder.filledQty).toBe(4);
    expect(takerOrder.fills).toHaveLength(1);
    expect(takerOrder.fills[0]).toMatchObject({
      makerOrderId: makerOrder.orderId,
      makerUserId: "seller",
      takerUserId: "buyer",
      makerSide: "sell",
      qty: 4,
      price: 100,
      symbol: "MATCH-USD",
    });
    expect(ORDERS.get(makerOrder.orderId)?.status).toBe("partially_filled");
    expect(ORDERS.get(makerOrder.orderId)?.filledQty).toBe(4);
    expect(POSITIONS.get("buyer")?.get("MATCH-USD")).toMatchObject({
      positionSide: "long",
      qty: 4,
      averagePrice: 100,
    });
    expect(POSITIONS.get("seller")?.get("MATCH-USD")).toMatchObject({
      positionSide: "short",
      qty: 4,
      averagePrice: 100,
    });
    expect(engineCommand("get_depth", { symbol: "MATCH-USD" }).asks).toEqual([[100, 6]]);
  });

  it("rejects orders that violate market limits or have no market liquidity", () => {
    engineCommand("create_market", {
      symbol: "VALIDATION-USD",
      maxLeverage: 3,
      minQty: 5,
    });
    engineCommand("add_balance", { userId: "validator", amount: 10_000 });

    expect(() =>
      engineCommand("create_order", {
        userId: "validator",
        symbol: "VALIDATION-USD",
        orderType: "limit",
        side: "buy",
        price: 100,
        qty: 5,
        leverage: 4,
      }),
    ).toThrow("maximum leverage allowed for VALIDATION-USD is 3");

    expect(() =>
      engineCommand("create_order", {
        userId: "validator",
        symbol: "VALIDATION-USD",
        orderType: "limit",
        side: "buy",
        price: 100,
        qty: 4,
        leverage: 1,
      }),
    ).toThrow("min qty is 5");

    expect(() =>
      engineCommand("create_order", {
        userId: "validator",
        symbol: "VALIDATION-USD",
        orderType: "market",
        side: "buy",
        qty: 5,
        leverage: 1,
        slippageBps: 10_000,
      }),
    ).toThrow("no liquidity on asks");
  });

  it("partially fills a market order and refunds margin for unfilled quantity", () => {
    engineCommand("create_market", {
      symbol: "PARTIAL-MARKET-USD",
      maxLeverage: 10,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "maker", amount: 10_000 });
    engineCommand("add_balance", { userId: "taker", amount: 1_000 });

    const makerOrder = engineCommand("create_order", {
      userId: "maker",
      symbol: "PARTIAL-MARKET-USD",
      orderType: "limit",
      side: "sell",
      price: 100,
      qty: 3,
      leverage: 1,
    });
    const takerOrder = engineCommand("create_order", {
      userId: "taker",
      symbol: "PARTIAL-MARKET-USD",
      orderType: "market",
      side: "buy",
      qty: 5,
      leverage: 1,
      slippageBps: 10_000,
    });

    expect(takerOrder.status).toBe("partially_filled");
    expect(takerOrder.filledQty).toBe(3);
    expect(takerOrder.fills).toHaveLength(1);
    expect(ORDERS.get(makerOrder.orderId)?.status).toBe("filled");
    expect(engineCommand("get_depth", { symbol: "PARTIAL-MARKET-USD" }).asks).toEqual([]);
    expect(engineCommand("get_balance", { userId: "taker" })).toEqual({
      available: 700,
      locked: 300,
    });
  });

  it("keeps unfilled limit quantity resting and refunds price improvement", () => {
    engineCommand("create_market", {
      symbol: "PRICE-IMPROVEMENT-USD",
      maxLeverage: 10,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "seller", amount: 10_000 });
    engineCommand("add_balance", { userId: "buyer", amount: 1_000 });

    engineCommand("create_order", {
      userId: "seller",
      symbol: "PRICE-IMPROVEMENT-USD",
      orderType: "limit",
      side: "sell",
      price: 100,
      qty: 2,
      leverage: 1,
    });
    const buyerOrder = engineCommand("create_order", {
      userId: "buyer",
      symbol: "PRICE-IMPROVEMENT-USD",
      orderType: "limit",
      side: "buy",
      price: 110,
      qty: 5,
      leverage: 1,
    });

    expect(buyerOrder.status).toBe("partially_filled");
    expect(buyerOrder.filledQty).toBe(2);
    expect(engineCommand("get_depth", { symbol: "PRICE-IMPROVEMENT-USD" })).toEqual({
      symbol: "PRICE-IMPROVEMENT-USD",
      asks: [],
      bids: [[110, 3]],
    });
    expect(engineCommand("get_balance", { userId: "buyer" })).toEqual({
      available: 470,
      locked: 530,
    });
  });

  it("cancels a resting order and refunds locked margin", () => {
    engineCommand("create_market", {
      symbol: "CANCEL-USD",
      maxLeverage: 5,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "canceller", amount: 1_000 });

    const order = engineCommand("create_order", {
      userId: "canceller",
      symbol: "CANCEL-USD",
      orderType: "limit",
      side: "buy",
      price: 50,
      qty: 4,
      leverage: 1,
    });
    expect(engineCommand("get_balance", { userId: "canceller" })).toEqual({
      available: 800,
      locked: 200,
    });

    const cancelledOrder = engineCommand("cancel_order", {
      userId: "canceller",
      orderId: order.orderId,
    });

    expect(cancelledOrder.status).toBe("cancelled");
    expect(engineCommand("get_balance", { userId: "canceller" })).toEqual({
      available: 1_000,
      locked: 0,
    });
    expect(engineCommand("get_depth", { symbol: "CANCEL-USD" }).bids).toEqual([]);
  });

  it("updates index prices without a response and rejects unknown commands", () => {
    const response = engineCommand("update_index_price", {
      symbol: "INDEX-USD",
      price: 123,
    });

    expect(response).toBeUndefined();
    expect(INDEX_PRICES.get("INDEX-USD")).toBe(123);
    expect(() =>
      handleCommand({
        correlationId: crypto.randomUUID(),
        responseQueue: "test-response-queue",
        type: "does_not_exist" as EngineCommandType,
        payload: {} as EngineRequest["payload"],
      }),
    ).toThrow("unknown command");
  });
});

describe("price feeder", () => {
  beforeEach(() => {
    subscribedMarkets.clear();
  });

  it("subscribes to a Binance mark-price stream once per market", () => {
    const sentMessages: string[] = [];
    const ws = {
      send(message: string) {
        sentMessages.push(message);
      },
    };

    newMarket(ws as any, "BTC");
    newMarket(ws as any, "BTC");
    newMarket(ws as any, "SOL");

    expect(sentMessages.map((message) => JSON.parse(message))).toEqual([
      {
        method: "SUBSCRIBE",
        params: ["btcusdt@markPrice@1s"],
        id: 1,
      },
      {
        method: "SUBSCRIBE",
        params: ["solusdt@markPrice@1s"],
        id: 2,
      },
    ]);
    expect(subscribedMarkets).toEqual(new Set(["BTC", "SOL"]));
  });
});
