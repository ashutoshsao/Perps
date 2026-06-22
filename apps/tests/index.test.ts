import { afterAll, beforeAll, describe, expect, it } from "bun:test";

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
