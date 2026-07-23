import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { EngineCommandType, EngineRequest } from "@repo/types";
import { handleCommand } from "../engine/src/controller/engine.controller";
import { BALANCES, FILLS, FUNDING_RATE_ACCOUMILATOR, INDEX_PRICES, LAST_FUNDING, MARK_PRICE_EWMA, MARKET_UPDATE_IDS, MARKETS, ORDERBOOKS, ORDERS, POSITIONS } from "../engine/src/engine-store";
import { getMarketSymbolsForFeedSymbol, newMarket, resetPriceFeederState, subscribedMarkets } from "../price-feeder/src/helper/newMarket";

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
let apiRestingOrderId = "";

let streamMsgCounter = 0;

function nextStreamMsgId() {
  streamMsgCounter += 1;
  return `${Date.now()}-${streamMsgCounter}`;
}

function engineCommand(type: EngineCommandType, payload: unknown = {}) {
  return handleCommand({
    streamMsgId: nextStreamMsgId(),
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
  MARKET_UPDATE_IDS.clear();
  MARKETS.clear();
  ORDERBOOKS.clear();
  ORDERS.clear();
  POSITIONS.clear();
  FUNDING_RATE_ACCOUMILATOR.clear();
  MARK_PRICE_EWMA.clear();
  LAST_FUNDING.clear();
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
  await loadEnvFile(`${WORKSPACE_ROOT}/apps/tests/.env`);

  process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379/15";
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

async function del(path: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers,
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `DELETE ${path} returned ${response.status} with a non-JSON body:\n${text}\n${processLogs.join("")}`,
      );
    }
  }

  return {
    response,
    json: json as any,
  };
}

async function get(path: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers,
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `GET ${path} returned ${response.status} with a non-JSON body:\n${text}\n${processLogs.join("")}`,
      );
    }
  }

  return {
    response,
    json: json as any,
  };
}

async function waitFor<T>(callback: () => Promise<T | undefined>, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const result = await callback();
      if (result !== undefined) return result;
    } catch (error) {
      lastError = error;
    }
    await Bun.sleep(100);
  }

  throw new Error(`Timed out waiting for condition: ${String(lastError)}\n${processLogs.join("")}`);
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
    startProcess("db-poller", ["bun", "apps/db-poller/index.ts"]);
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

      const { response: marketsResponse, json: marketsJson } = await get("/markets");
      expect(marketsResponse.status).toBe(200);
      expect(marketsJson.markets.some((market: any) => market.symbol === marketSymbol)).toBe(true);
    });

    it("adds balance", async () => {
      const { response, json } = await post(
        "/onramp",
        { amount: 100_000 },
        { authorization: `Bearer ${authToken}` },
      );

      expect(response.status).toBe(200);
      expect(json.response.available).toBeGreaterThanOrEqual(100_000);

      const { response: balanceResponse, json: balanceJson } = await get(
        "/balance",
        { authorization: `Bearer ${authToken}` },
      );
      expect(balanceResponse.status).toBe(200);
      expect(balanceJson.response.available).toBeGreaterThanOrEqual(100_000);
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
      expect(json.order.orderId).toBeString();
      apiRestingOrderId = json.order.orderId;
      expect(json.order.filledQty).toBe(0);
      expect(json.order.status).toBe("open");
      expect(json.depthDiff).toMatchObject({
        symbol: marketSymbol,
        firstUpdateId: 1,
        finalUpdateId: 1,
        prevUpdateId: 0,
        bids: [[100, 10]],
        asks: [],
      });

      const { response: depthResponse, json: depthJson } = await get(`/depth/${marketSymbol}`);
      expect(depthResponse.status).toBe(200);
      expect(depthJson.bids).toEqual([[100, 10]]);
      expect(depthJson.asks).toEqual([]);

      await waitFor(async () => {
        const { response: ordersResponse, json: ordersJson } = await get(
          "/orders",
          { authorization: `Bearer ${authToken}` },
        );
        expect(ordersResponse.status).toBe(200);

        return ordersJson.orders.some((order: any) => order.id === apiRestingOrderId)
          ? ordersJson
          : undefined;
      });
    });

    it("cancels a resting order through the API cancel route", async () => {
      const { response, json } = await del(
        `/order/${apiRestingOrderId}`,
        { authorization: `Bearer ${authToken}` },
      );

      expect(response.status).toBe(200);
      expect(json.order.orderId).toBe(apiRestingOrderId);
      expect(json.order.status).toBe("cancelled");
      expect(json.depthDiff).toMatchObject({
        symbol: marketSymbol,
        firstUpdateId: 2,
        finalUpdateId: 2,
        prevUpdateId: 1,
        bids: [[100, 0]],
        asks: [],
      });

      await waitFor(async () => {
        const { response: ordersResponse, json: ordersJson } = await get(
          "/orders",
          { authorization: `Bearer ${authToken}` },
        );
        expect(ordersResponse.status).toBe(200);

        return ordersJson.orders.find((order: any) =>
          order.id === apiRestingOrderId && order.status === "cancelled"
        );
      });
    });

    it("returns empty market-data arrays when no trades have printed", async () => {
      const { response: tradesResponse, json: tradesJson } = await get(`/trades/${marketSymbol}`);
      expect(tradesResponse.status).toBe(200);
      expect(tradesJson.trades).toEqual([]);

      const { response: klinesResponse, json: klinesJson } = await get(`/klines/${marketSymbol}`);
      expect(klinesResponse.status).toBe(200);
      expect(klinesJson.candles).toEqual([]);

      const { response: tickerResponse } = await get(`/ticker/${marketSymbol}`);
      expect(tickerResponse.status).toBe(404);
    });

    it("builds different OHLCV buckets from multiple fills per interval", async () => {
      const { timescale } = await import("@repo/db");
      const symbol = `KLINES-${crypto.randomUUID().slice(0, 8).toUpperCase()}-USD`;
      const base = Date.UTC(2026, 5, 30, 10, 0, 0);
      const rows = [
        [crypto.randomUUID(), new Date(base + 5_000), symbol, 100, 1, "buy"],
        [crypto.randomUUID(), new Date(base + 90_000), symbol, 110, 2, "buy"],
        [crypto.randomUUID(), new Date(base + 6 * 60_000), symbol, 90, 3, "sell"],
        [crypto.randomUUID(), new Date(base + 65 * 60_000), symbol, 120, 4, "buy"],
        [crypto.randomUUID(), new Date(base + 24 * 60 * 60_000), symbol, 130, 5, "sell"],
      ];

      for (const row of rows) {
        await timescale.query(
          `INSERT INTO fills_ts (fill_id, time, symbol, price, qty, side)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          row,
        );
      }

      const from = base - 60_000;
      const to = base + 25 * 60 * 60_000;
      const klinesPath = (interval: string) => `/klines/${symbol}?interval=${interval}&from=${from}&to=${to}`;

      const oneMinute = await get(klinesPath("1m"));
      expect(oneMinute.response.status).toBe(200);
      expect(oneMinute.json.candles).toHaveLength(5);
      expect(oneMinute.json.candles[0]).toMatchObject({
        open: "100",
        high: "100",
        low: "100",
        close: "100",
        volume: "1",
      });

      const fiveMinute = await get(klinesPath("5m"));
      expect(fiveMinute.response.status).toBe(200);
      expect(fiveMinute.json.candles).toHaveLength(4);
      expect(fiveMinute.json.candles[0]).toMatchObject({
        open: "100",
        high: "110",
        low: "100",
        close: "110",
        volume: "3",
      });

      const oneHour = await get(klinesPath("1h"));
      expect(oneHour.response.status).toBe(200);
      expect(oneHour.json.candles).toHaveLength(3);
      expect(oneHour.json.candles[0]).toMatchObject({
        open: "100",
        high: "110",
        low: "90",
        close: "90",
        volume: "6",
      });

      const oneDay = await get(klinesPath("1d"));
      expect(oneDay.response.status).toBe(200);
      expect(oneDay.json.candles).toHaveLength(2);
      expect(oneDay.json.candles[0]).toMatchObject({
        open: "100",
        high: "120",
        low: "90",
        close: "120",
        volume: "10",
      });
    });

    it("persists matched fills and exposes them as recent trades", async () => {
      const restingSell = await post(
        "/order",
        {
          orderType: "limit",
          side: "sell",
          price: 120,
          qty: 2,
          leverage: 1,
          symbol: marketSymbol,
        },
        { authorization: `Bearer ${authToken}` },
      );
      expect(restingSell.response.status).toBe(200);

      const marketBuy = await post(
        "/order",
        {
          orderType: "market",
          side: "buy",
          qty: 2,
          leverage: 1,
          slippageBps: 10_000,
          symbol: marketSymbol,
        },
        { authorization: `Bearer ${authToken}` },
      );
      expect(marketBuy.response.status).toBe(200);
      expect(marketBuy.json.fills).toHaveLength(1);

      const fillId = marketBuy.json.fills[0].fillId;

      await waitFor(async () => {
        const { response: fillsResponse, json: fillsJson } = await get(
          "/fills",
          { authorization: `Bearer ${authToken}` },
        );
        expect(fillsResponse.status).toBe(200);

        const fill = fillsJson.fills.find((fill: any) => fill.id === fillId);
        if (!fill) return undefined;

        expect(fill).toMatchObject({
          id: fillId,
          symbol: marketSymbol,
          makerSide: "sell",
          side: "sell",
        });
        return fill;
      });

      await waitFor(async () => {
        const { response: ordersResponse, json: ordersJson } = await get(
          "/orders",
          { authorization: `Bearer ${authToken}` },
        );
        expect(ordersResponse.status).toBe(200);

        return ordersJson.orders.find((order: any) =>
          order.id === restingSell.json.order.orderId &&
          order.status === "filled" &&
          order.filledQty === 2
        );
      });

      await waitFor(async () => {
        const { response: ordersResponse, json: ordersJson } = await get(
          "/orders",
          { authorization: `Bearer ${authToken}` },
        );
        expect(ordersResponse.status).toBe(200);
        expect(ordersJson.orders.some((order: any) =>
          order.id === restingSell.json.order.orderId &&
          (order.status === "open" || order.status === "partially_filled")
        )).toBe(false);

        return ordersJson.orders.find((order: any) =>
          order.id === restingSell.json.order.orderId &&
          order.status === "filled"
        );
      });

      await waitFor(async () => {
        const { response: tradesResponse, json: tradesJson } = await get(`/trades/${marketSymbol}`);
        expect(tradesResponse.status).toBe(200);

        return tradesJson.trades.find((trade: any) =>
          trade.symbol === marketSymbol &&
          Number(trade.price) === 120 &&
          Number(trade.qty) === 2 &&
          trade.side === "buy"
        );
      });
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
      marketId: "depth-market",
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
      lastUpdateId: 4,
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
      marketId: "match-market",
      symbol: "MATCH-USD",
      maxLeverage: 10,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "seller", amount: 20_000 });
    engineCommand("add_balance", { userId: "buyer", amount: 20_000 });

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

    expect(takerOrder.order.status).toBe("filled");
    expect(takerOrder.order.filledQty).toBe(4);
    expect(takerOrder.fills).toHaveLength(1);
    expect(takerOrder.fills[0]).toMatchObject({
      makerOrderId: makerOrder.order.orderId,
      makerUserId: "seller",
      takerUserId: "buyer",
      makerSide: "sell",
      qty: 4,
      price: 100,
      symbol: "MATCH-USD",
    });
    expect(takerOrder.fills[0].createdAt).toBeNumber();
    expect(takerOrder.makerOrders).toHaveLength(1);
    expect(takerOrder.makerOrders[0].orderId).toBe(makerOrder.order.orderId);
    expect(takerOrder.makerOrders[0].status).toBe("partially_filled");
    expect(takerOrder.depthDiff).toEqual({
      symbol: "MATCH-USD",
      firstUpdateId: 2,
      finalUpdateId: 2,
      prevUpdateId: 1,
      bids: [],
      asks: [[100, 6]],
    });
    expect(ORDERS.get(makerOrder.order.orderId)?.status).toBe("partially_filled");
    expect(ORDERS.get(makerOrder.order.orderId)?.filledQty).toBe(4);
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

  it("applies market slippage bps around the best price", () => {
    engineCommand("create_market", {
      marketId: "slippage-market",
      symbol: "SLIPPAGE-USD",
      maxLeverage: 10,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "seller", amount: 20_000 });
    engineCommand("add_balance", { userId: "buyer", amount: 20_000 });

    engineCommand("create_order", {
      userId: "seller",
      symbol: "SLIPPAGE-USD",
      orderType: "limit",
      side: "sell",
      price: 6_000,
      qty: 2,
      leverage: 1,
    });
    const marketOrder = engineCommand("create_order", {
      userId: "buyer",
      symbol: "SLIPPAGE-USD",
      orderType: "market",
      side: "buy",
      qty: 2,
      leverage: 1,
      slippageBps: 100,
    });

    expect(marketOrder.order.price).toBe(6_060);
    expect(marketOrder.order.status).toBe("filled");
    expect(marketOrder.order.filledQty).toBe(2);
    expect(marketOrder.fills[0]).toMatchObject({
      price: 6_000,
      qty: 2,
      symbol: "SLIPPAGE-USD",
    });
  });

  it("rejects orders that violate market limits or have no market liquidity", () => {
    engineCommand("create_market", {
      marketId: "validation-market",
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
      marketId: "partial-market",
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

    expect(takerOrder.order.status).toBe("partially_filled");
    expect(takerOrder.order.filledQty).toBe(3);
    expect(takerOrder.fills).toHaveLength(1);
    expect(takerOrder.depthDiff.asks).toEqual([[100, 0]]);
    expect(ORDERS.get(makerOrder.order.orderId)?.status).toBe("filled");
    expect(engineCommand("get_depth", { symbol: "PARTIAL-MARKET-USD" }).asks).toEqual([]);
    expect(engineCommand("get_balance", { userId: "taker" })).toEqual({
      available: 700,
      locked: 300,
    });
  });

  it("keeps unfilled limit quantity resting and refunds price improvement", () => {
    engineCommand("create_market", {
      marketId: "price-improvement-market",
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

    expect(buyerOrder.order.status).toBe("partially_filled");
    expect(buyerOrder.order.filledQty).toBe(2);
    expect(buyerOrder.depthDiff).toEqual({
      symbol: "PRICE-IMPROVEMENT-USD",
      firstUpdateId: 2,
      finalUpdateId: 2,
      prevUpdateId: 1,
      bids: [[110, 3]],
      asks: [[100, 0]],
    });
    expect(engineCommand("get_depth", { symbol: "PRICE-IMPROVEMENT-USD" })).toEqual({
      symbol: "PRICE-IMPROVEMENT-USD",
      lastUpdateId: 2,
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
      marketId: "cancel-market",
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
      orderId: order.order.orderId,
    });

    expect(cancelledOrder.order.status).toBe("cancelled");
    expect(cancelledOrder.depthDiff).toEqual({
      symbol: "CANCEL-USD",
      firstUpdateId: 2,
      finalUpdateId: 2,
      prevUpdateId: 1,
      bids: [[50, 0]],
      asks: [],
    });
    expect(engineCommand("get_balance", { userId: "canceller" })).toEqual({
      available: 1_000,
      locked: 0,
    });
    expect(engineCommand("get_depth", { symbol: "CANCEL-USD" }).bids).toEqual([]);
  });

  it("returns the mark price on index updates and rejects unknown commands", () => {
    const response = engineCommand("update_index_price", {
      symbol: "INDEX-USD",
      price: 123,
    });

    // no orderbook for this symbol — mark price falls back to the index price
    expect(response).toEqual({ symbol: "INDEX-USD", markPrice: 123, events: [] });
    expect(INDEX_PRICES.get("INDEX-USD")).toBe(123);
    expect(() =>
      handleCommand({
        streamMsgId: nextStreamMsgId(),
        correlationId: crypto.randomUUID(),
        responseQueue: "test-response-queue",
        type: "does_not_exist" as EngineCommandType,
        payload: {} as EngineRequest["payload"],
      }),
    ).toThrow("unknown command");
  });

  it("settles funding across every market using the accumulated premium average", () => {
    for (const symbol of ["FUNDING-A-USD", "FUNDING-B-USD"]) {
      engineCommand("create_market", {
        marketId: `${symbol}-market`,
        symbol,
        maxLeverage: 10,
        minQty: 1,
      });
      engineCommand("add_balance", { userId: `${symbol}-seller`, amount: 20_000 });
      engineCommand("add_balance", { userId: `${symbol}-buyer`, amount: 20_000 });

      engineCommand("create_order", {
        userId: `${symbol}-seller`,
        symbol,
        orderType: "limit",
        side: "sell",
        price: 100,
        qty: 10,
        leverage: 1,
      });
      engineCommand("create_order", {
        userId: `${symbol}-buyer`,
        symbol,
        orderType: "market",
        side: "buy",
        qty: 10,
        leverage: 1,
        slippageBps: 10_000,
      });

      // two index-price ticks so the accumulator has more than one sample to average
      engineCommand("update_index_price", { symbol, price: 99 });
      engineCommand("update_index_price", { symbol, price: 99 });
    }

    const buyerMarginBefore = POSITIONS.get("FUNDING-A-USD-buyer")?.get("FUNDING-A-USD")!.margin;
    const sellerMarginBefore = POSITIONS.get("FUNDING-A-USD-seller")?.get("FUNDING-A-USD")!.margin;

    const response = engineCommand("funding_rate", {});
    const settlements = response.settlements as Array<{ symbol: string; userId: string; rate: number; settledAt: number }>;

    // both markets settled — proves the multi-market loop isn't cut short
    expect(settlements.some((s) => s.symbol === "FUNDING-A-USD")).toBe(true);
    expect(settlements.some((s) => s.symbol === "FUNDING-B-USD")).toBe(true);
    expect(settlements.length).toBe(4); // buyer + seller for each of the 2 markets

    for (const settlement of settlements) {
      // averaged premium, not the extreme instantaneous value, and within the clamp
      expect(Math.abs(settlement.rate)).toBeLessThanOrEqual(0.0075);
      expect(settlement.settledAt).toBeNumber();
    }

    // long pays short (index below last traded price) — margin should move in opposite directions
    const buyerMarginAfter = POSITIONS.get("FUNDING-A-USD-buyer")?.get("FUNDING-A-USD")!.margin;
    const sellerMarginAfter = POSITIONS.get("FUNDING-A-USD-seller")?.get("FUNDING-A-USD")!.margin;
    expect(buyerMarginAfter).toBeLessThan(buyerMarginBefore!);
    expect(sellerMarginAfter).toBeGreaterThan(sellerMarginBefore!);

    // accumulator resets after settlement
    expect(FUNDING_RATE_ACCOUMILATOR.get("FUNDING-A-USD")).toEqual({ sumPremium: 0, samples: 0 });
    expect(LAST_FUNDING.get("FUNDING-A-USD")).toBe(
      settlements.find((s) => s.symbol === "FUNDING-A-USD")!.rate,
    );
  });

  it("falls back to the last settled rate when no index-price ticks occurred this window", () => {
    engineCommand("create_market", {
      marketId: "funding-fallback-market",
      symbol: "FUNDING-FALLBACK-USD",
      maxLeverage: 10,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "fallback-seller", amount: 20_000 });
    engineCommand("add_balance", { userId: "fallback-buyer", amount: 20_000 });

    engineCommand("create_order", {
      userId: "fallback-seller",
      symbol: "FUNDING-FALLBACK-USD",
      orderType: "limit",
      side: "sell",
      price: 100,
      qty: 10,
      leverage: 1,
    });
    engineCommand("create_order", {
      userId: "fallback-buyer",
      symbol: "FUNDING-FALLBACK-USD",
      orderType: "market",
      side: "buy",
      qty: 10,
      leverage: 1,
      slippageBps: 10_000,
    });

    engineCommand("update_index_price", { symbol: "FUNDING-FALLBACK-USD", price: 99 });

    const first = engineCommand("funding_rate", {});
    const firstRate = first.settlements.find(
      (s: { symbol: string }) => s.symbol === "FUNDING-FALLBACK-USD",
    ).rate;

    // no new update_index_price ticks before the second settlement — accumulator is empty
    expect(FUNDING_RATE_ACCOUMILATOR.get("FUNDING-FALLBACK-USD")).toEqual({ sumPremium: 0, samples: 0 });

    const second = engineCommand("funding_rate", {});
    const secondRate = second.settlements.find(
      (s: { symbol: string }) => s.symbol === "FUNDING-FALLBACK-USD",
    ).rate;

    expect(secondRate).toBe(firstRate);
  });

  it("liquidates a position through update_index_price and returns a tagged synthetic order", () => {
    engineCommand("create_market", {
      marketId: "liq-market",
      symbol: "LIQ-USD",
      maxLeverage: 10,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "liq-trader", amount: 10_000 });
    engineCommand("add_balance", { userId: "liq-maker", amount: 10_000 });
    engineCommand("add_balance", { userId: "liq-liquidity-buyer", amount: 10_000 });

    // resting ask so the trader can open a long position
    engineCommand("create_order", {
      userId: "liq-maker",
      symbol: "LIQ-USD",
      orderType: "limit",
      side: "sell",
      price: 100,
      qty: 10,
      leverage: 1,
    });

    // opens a 10x long — liquidationPrice = 100 - floor(margin/qty) = 100 - 10 = 90
    engineCommand("create_order", {
      userId: "liq-trader",
      symbol: "LIQ-USD",
      orderType: "market",
      side: "buy",
      qty: 10,
      leverage: 10,
      slippageBps: 10_000,
    });

    // resting bid so the forced liquidation sell has somewhere to match (not ADL)
    engineCommand("create_order", {
      userId: "liq-liquidity-buyer",
      symbol: "LIQ-USD",
      orderType: "limit",
      side: "buy",
      price: 89,
      qty: 10,
      leverage: 1,
    });

    const response = engineCommand("update_index_price", { symbol: "LIQ-USD", price: 89 });

    expect(response.symbol).toBe("LIQ-USD");
    expect(response.markPrice).toBeNumber();
    expect(Array.isArray(response.events)).toBe(true);
    const liquidation = (response.events as Array<{ order: { userId: string; side: string }; fills: unknown[]; reason?: string }>)
      .find((event) => event.order.userId === "liq-trader");

    expect(liquidation).toBeDefined();
    expect(liquidation!.reason).toBe("liquidation");
    expect(liquidation!.order.side).toBe("sell");
    expect(liquidation!.fills.length).toBeGreaterThan(0);
  });

  it("computes the EWMA mark price from the last traded price", () => {
    engineCommand("create_market", {
      marketId: "ewma-market",
      symbol: "EWMA-USD",
      maxLeverage: 10,
      minQty: 1,
    });
    engineCommand("add_balance", { userId: "ewma-seller", amount: 20_000 });
    engineCommand("add_balance", { userId: "ewma-buyer", amount: 20_000 });

    engineCommand("create_order", {
      userId: "ewma-seller",
      symbol: "EWMA-USD",
      orderType: "limit",
      side: "sell",
      price: 100,
      qty: 5,
      leverage: 1,
    });
    engineCommand("create_order", {
      userId: "ewma-buyer",
      symbol: "EWMA-USD",
      orderType: "market",
      side: "buy",
      qty: 5,
      leverage: 1,
      slippageBps: 10_000,
    });

    // first tick: prevMark seeds from the index price -> 0.15*100 + 0.85*90 = 91.5
    const first = engineCommand("update_index_price", { symbol: "EWMA-USD", price: 90 });
    expect(first.markPrice).toBe(Math.round(0.15 * 100 + 0.85 * 90)); // 92
    expect(MARK_PRICE_EWMA.get("EWMA-USD")).toBeCloseTo(91.5);

    // second tick: converges toward last traded price -> 0.15*100 + 0.85*91.5 = 92.775
    const second = engineCommand("update_index_price", { symbol: "EWMA-USD", price: 90 });
    expect(second.markPrice).toBe(Math.round(0.15 * 100 + 0.85 * 91.5)); // 93
    expect(MARK_PRICE_EWMA.get("EWMA-USD")).toBeCloseTo(92.775);
  });

  it("keeps the mark price at the index price for markets with no trades", () => {
    engineCommand("create_market", {
      marketId: "untraded-market",
      symbol: "UNTRADED-USD",
      maxLeverage: 10,
      minQty: 1,
    });

    // lastTradedPrice is 0 — the EWMA must not decay toward it, and the
    // funding accumulator must not collect poisoned samples
    for (let i = 0; i < 3; i++) {
      const response = engineCommand("update_index_price", { symbol: "UNTRADED-USD", price: 100 });
      expect(response.markPrice).toBe(100);
    }
    expect(MARK_PRICE_EWMA.has("UNTRADED-USD")).toBe(false);
    expect(FUNDING_RATE_ACCOUMILATOR.has("UNTRADED-USD")).toBe(false);
  });
});

describe("price feeder", () => {
  beforeEach(() => {
    resetPriceFeederState();
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

  it("fans a shared feed symbol out to every market on it, instead of the last one winning", () => {
    // regression: two markets with the same base asset but different quote
    // segments (e.g. "PUMP-PERP" and "PUMP-USD") both resolve to Binance
    // feed symbol PUMPUSDT. The old implementation kept a single
    // feedSymbol -> marketSymbol mapping, so the second newMarket() call
    // silently overwrote the first — that market's index price went dead
    // forever with no error anywhere in the pipeline.
    const sentMessages: string[] = [];
    const ws = {
      send(message: string) {
        sentMessages.push(message);
      },
    };

    newMarket(ws as any, "PUMP-PERP");
    newMarket(ws as any, "PUMP-USD");

    // only one Binance SUBSCRIBE for the shared feed symbol — no duplicate stream
    expect(sentMessages).toHaveLength(1);
    expect(JSON.parse(sentMessages[0]!).params).toEqual(["pumpusdt@markPrice@1s"]);

    // but both markets are still tracked and would both receive the tick
    expect(getMarketSymbolsForFeedSymbol("PUMPUSDT")).toEqual(new Set(["PUMP-PERP", "PUMP-USD"]));
  });

  it("maps a base-quote market symbol to its base-asset Binance feed, ignoring the quote segment", () => {
    // regression: toBinanceSymbol used to only strip "-"/"_"/"/" and append USDT,
    // so "BTC-PERP" became the bogus feed symbol "BTCPERPUSDT" — Binance silently
    // ACKs a SUBSCRIBE to it but never pushes data, so index prices went dead
    // with no error anywhere in the pipeline.
    const sentMessages: string[] = [];
    const ws = {
      send(message: string) {
        sentMessages.push(message);
      },
    };

    newMarket(ws as any, "BTC-PERP");
    newMarket(ws as any, "ETH-USD");

    expect(sentMessages.map((message) => JSON.parse(message).params[0])).toEqual([
      "btcusdt@markPrice@1s",
      "ethusdt@markPrice@1s",
    ]);
  });
});
