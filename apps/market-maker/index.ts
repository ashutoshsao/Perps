import { api, ApiError, ensureUser } from "./src/api";
import { Env, MARKET_SPECS } from "./src/config";
import { IndexFeed } from "./src/feed";
import { runDegen } from "./src/degen";
import { cancelStaleOrders, runQuoter, topUp } from "./src/quoter";
import { runTaker } from "./src/taker";
import { log, sleep } from "./src/util";

async function waitForApi() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await api.ping();
      return;
    } catch {
      await sleep(2000);
    }
  }
  throw new Error(`API not reachable at ${Env.apiUrl}`);
}

async function ensureMarkets(auth: Awaited<ReturnType<typeof ensureUser>>) {
  for (const spec of MARKET_SPECS) {
    try {
      await api.createMarket(auth, spec);
      log("bootstrap", `created market ${spec.symbol}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) continue; // already seeded
      if (err instanceof ApiError && err.status === 401) {
        throw new Error("ADMIN_SECRET is missing or wrong — the bot needs it to seed markets");
      }
      throw err;
    }
  }
}

async function main() {
  await waitForApi();
  log("bootstrap", `api reachable at ${Env.apiUrl}`);

  const quoter = await ensureUser("nebula-mm", "Nebula Liquidity");
  const taker = await ensureUser("flow-desk", "Flow Desk");
  const degen = await ensureUser("leverage-larry", "Leverage Larry");

  await ensureMarkets(quoter);

  await topUp(quoter, "bootstrap:quoter");
  await topUp(taker, "bootstrap:taker", 200_000_000, 5_000_000_000);
  await topUp(degen, "bootstrap:degen", 10_000_000, 100_000_000);

  await cancelStaleOrders(quoter, "bootstrap:quoter");

  // leave the book clean when the service is stopped, so markets don't show stale quotes
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("shutdown", "cancelling resting bot orders");
    await cancelStaleOrders(quoter, "shutdown");
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  const feed = new IndexFeed(MARKET_SPECS.map((spec) => spec.symbol));
  feed.start();
  await sleep(3000); // let the first index ticks land before quoting

  for (const spec of MARKET_SPECS) {
    if (Env.quoterEnabled) void runQuoter(quoter, feed, spec);
    if (Env.takerEnabled) void runTaker(taker, feed, spec);
  }
  if (Env.degenEnabled) runDegen(degen, feed, MARKET_SPECS);

  const enabled = [
    Env.quoterEnabled && "quoter",
    Env.takerEnabled && "taker",
    Env.degenEnabled && "degen",
  ].filter(Boolean);
  log("bootstrap", `running [${enabled.join(", ")}] on ${MARKET_SPECS.map((spec) => spec.symbol).join(", ")}`);
}

main().catch((err) => {
  console.error("market-maker crashed:", err);
  process.exit(1);
});
