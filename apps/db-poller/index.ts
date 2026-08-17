import { getRedisClient } from "@repo/redis";
import { REDIS_KEYS } from "@repo/types";
import type { RedisResponseType } from "@repo/types";
import { updateDb } from "./src/updateDb";
const readRedis = getRedisClient();

const DB_EVENTS = new Set(["update_index_price", "funding_rate", "create_order", "cancel_order"]);
const GROUP = "db-poller"
const CONSUMER = `dbPoller-${crypto.randomUUID()}`
const CLAIM_IDLE_MS = 30_000

async function handleMessage(client: Awaited<typeof readRedis>, id: string, message: Record<string, string>) {
  const { type, ok, data } = message

  if (!DB_EVENTS.has(type) || ok !== 'true') {
    await client.xAck(REDIS_KEYS.engineEvents, GROUP, id)
    return
  }

  try {
    await updateDb(type, data ? JSON.parse(data) : undefined)
    await client.xAck(REDIS_KEYS.engineEvents, GROUP, id)
  } catch (err) {
    console.error("DB write failed:", err)
    // don't ack — message stays pending, will be reclaimed by claimStale
  }
}

// reclaims entries left pending by consumers that crashed/restarted before acking —
// without this, every dead consumer's in-flight messages are lost forever
async function claimStale(client: Awaited<typeof readRedis>) {
  let cursor = '0-0'
  do {
    const result = await client.xAutoClaim(REDIS_KEYS.engineEvents, GROUP, CONSUMER, CLAIM_IDLE_MS, cursor, { COUNT: 100 })
    for (const msg of result.messages) {
      if (!msg) continue
      await handleMessage(client, msg.id, msg.message)
    }
    cursor = result.nextId
  } while (cursor !== '0-0')
}

async function dbPoller() {
  const client = await readRedis;
  try {
    await client.xGroupCreate(REDIS_KEYS.engineEvents, GROUP, '0', { MKSTREAM: true })
  } catch {
    // group already exists — fine
  }

  await claimStale(client)
  setInterval(() => claimStale(client).catch((err) => console.error("claimStale failed:", err)), CLAIM_IDLE_MS)

  while (true) {
    const streams = await client.xReadGroup(GROUP, CONSUMER, [{
      key: REDIS_KEYS.engineEvents,
      id: '>'
    }], {
      BLOCK: 0,
      COUNT: 1

    }) as RedisResponseType | null;
    if (!streams) continue;
    for (const stream of streams) {
      for (const msg of stream.messages) {
        await handleMessage(client, msg.id, msg.message)
      }
    }
  }
}

dbPoller().catch(() => process.exit(1))
