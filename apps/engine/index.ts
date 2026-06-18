import { getRedisClient } from "@repo/redis";
import { EngineRequest, REDIS_KEYS, RedisResponseType } from "@repo/types";
import { handleCommand } from "./src/controller/engine.controller";
import { loadSnapshot } from "./src/helper/snapshot";

const GLOBAL_EVENTS = new Set([
  "create_order",
  "cancel_order",
  "create_market"
])
let lastSeenId;
const readClient = getRedisClient()
const writeClient = getRedisClient()
async function startUp() {
  //loadSnapshot
  lastSeenId = await loadSnapshot();
  let readRedis = await readClient;
  let writeRedis = await writeClient;
  while (true) {
    const streams = await readRedis.xRead([{
      key: REDIS_KEYS.engineCommands,
      id: lastSeenId
    }], {
      BLOCK: 0,
      COUNT: 1
    }) as RedisResponseType | null;
    if (!streams) continue;
    for (const stream of streams) {
      for (const msg of stream.messages) {
        lastSeenId = msg.id;
        const { correlationId, type, responseQueue, payload } = msg.message
        try {

          const request: EngineRequest = {
            correlationId,
            type: type as EngineRequest['type'],
            responseQueue,
            payload: JSON.parse(payload)
          }

          const response = handleCommand(request);

          if (!response) continue;// for update_index_price

          if (GLOBAL_EVENTS.has(type)) {
            // create_order, cancel_order, create_market,
            await writeRedis.xAdd(REDIS_KEYS.engineEvents, '*', {
              type,
              correlationId,
              ok: 'true',
              error: '',
              data: JSON.stringify(response),
            })
          } else {
            await writeRedis.xAdd(responseQueue, '*', {
              type,
              correlationId,
              ok: 'true',
              error: '',
              data: JSON.stringify(response),
            })
          }
        }
        catch (err) {
          await writeRedis.xAdd(responseQueue, '*', {
            type,
            correlationId,
            ok: 'false',
            error: (err as Error).message,
            data: '',
          })
        }
      }
    }
  }
}
startUp().catch((err) => {
  console.error("Engine crashed:", err);
  process.exit(1);
});
