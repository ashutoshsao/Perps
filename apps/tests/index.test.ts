import { afterAll, beforeAll, describe, expect, it } from "bun:test";

const WORKSPACE_ROOT = `${import.meta.dir}/../..`;
const PORT = Number(process.env.TEST_API_PORT ?? "4210");
const BASE_URL = `http://127.0.0.1:${PORT}/api`;
const startedProcesses: Array<ReturnType<typeof Bun.spawn>> = [];
const processLogs: string[] = [];

let authToken = "";
let marketSymbol = "";

const requiredEnv = ["DATABASE_URL", "REDIS_URL"] as const;

async function loadEnvFile(path: string) {
  const file = Bun.file(path);
  if (!(await file.exists())) return;

  const text = await file.text();
  for (const line of text.split("\n")) {
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

function assertRequiredEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing test env: ${missing.join(", ")}`);
  }
}

function envForApp() {
  return {
    ...process.env,
    PORT: String(PORT),
    JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret",
    ADMIN_SECRET: process.env.ADMIN_SECRET ?? "test-admin-secret",
  };
}

async function readProcessOutput(label: string, stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      processLogs.push(`[${label}] ${decoder.decode(value)}`);
    }
  } catch {
    // Process output streams close when the process is killed in afterAll.
  }
}

function startProcess(label: string, args: string[]) {
  const proc = Bun.spawn(args, {
    cwd: WORKSPACE_ROOT,
    env: envForApp(),
    stdout: "pipe",
    stderr: "pipe",
  });

  startedProcesses.push(proc);
  void readProcessOutput(`${label}:stdout`, proc.stdout);
  void readProcessOutput(`${label}:stderr`, proc.stderr);

  return proc;
}

async function waitForApi() {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 15_000) {
    const exited = startedProcesses.find((proc) => proc.exitCode !== null);
    if (exited) {
      throw new Error(`A test process exited early with code ${exited.exitCode}\n${processLogs.join("")}`);
    }

    try {
      const response = await fetch(`${BASE_URL}/signin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.status === 400) return;
    } catch (error) {
      lastError = error;
    }

    await Bun.sleep(250);
  }

  throw new Error(`API did not become ready: ${String(lastError)}\n${processLogs.join("")}`);
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
  const json = text ? JSON.parse(text) : null;

  return { response, json };
}

beforeAll(async () => {
  await loadAppEnv();
  assertRequiredEnv();
  startProcess("engine", ["bun", "apps/engine/index.ts"]);
  startProcess("api", ["bun", "apps/api/index.ts"]);
  await waitForApi();
}, 20_000);

afterAll(() => {
  for (const proc of startedProcesses) {
    proc.kill();
  }
});

describe("api exchange flow", () => {
  it("signs up a user", async () => {
    const username = `test-user-${crypto.randomUUID()}@example.com`;
    const { response, json } = await post("/signup", {
      name: "Test User",
      username,
      password: "password-123",
    });

    expect(response.status).toBe(201);
    expect(json.token).toBeString();
  });

  it("signs in the user", async () => {
    const username = `signin-user-${crypto.randomUUID()}@example.com`;
    const password = "password-123";

    await post("/signup", {
      name: "Signin User",
      username,
      password,
    });

    const { response, json } = await post("/signin", {
      username,
      password,
    });

    expect(response.status).toBe(200);
    expect(json.token).toBeString();
    authToken = json.token;
  });

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

  it("onramps balance", async () => {
    const { response, json } = await post(
      "/onramp",
      { amount: 100_000 },
      { authorization: `Bearer ${authToken}` },
    );

    expect(response.status).toBe(200);
    expect(json.response.available).toBeGreaterThanOrEqual(100_000);
  });

  it("places a limit order", async () => {
    const { response, json } = await post(
      "/order",
      {
        orderType: "limit",
        side: "buy",
        price: 100,
        qty: 1,
        leverage: 1,
        symbol: marketSymbol,
      },
      { authorization: `Bearer ${authToken}` },
    );

    expect(response.status).toBe(200);
    expect(json.orderId).toBeString();
    expect(json.symbol).toBe(marketSymbol);
    expect(json.orderType).toBe("limit");
    expect(json.status).toBe("open");
  });
});
