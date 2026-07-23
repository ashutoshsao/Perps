import { getRedisClient } from "@repo/redis";
import { REDIS_KEYS } from "@repo/types";
import type { RedisResponseType } from "@repo/types";
import { updateDb } from "./src/updateDb";
const readRedis = getRedisClient();

const DB_EVENTS = new Set(["update_index_price", "funding_rate", "create_order", "cancel_order"]);
const GROUP = "db-puller"
const CONSUMER = "db-puller-1"

async function dbPuller() {
  const client = await readRedis;
  try {
    await client.xGroupCreate(REDIS_KEYS.engineEvents, GROUP, '0', { MKSTREAM: true })
  } catch {
    // group already exists — fine
  }
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
        //skip rest types other then dbEvents
        const { type, ok, data } = msg.message

        if (!DB_EVENTS.has(type) || ok !== 'true') {
          // ack and skip — not our concern
          await client.xAck(REDIS_KEYS.engineEvents, GROUP, msg.id)
          continue
        }

        try {
          await updateDb(type, data ? JSON.parse(data) : undefined)
          await client.xAck(REDIS_KEYS.engineEvents, GROUP, msg.id)
        } catch (err) {
          console.error("DB write failed:", err)
          // don't ack — message will be redelivered on restart
        }
      }
    }
  }
}

dbPuller().catch(() => process.exit(1))
