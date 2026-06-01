import { getRedisClient } from "@repo/redis";
import { EngineRequest, REDIS_KEYS, RedisResponseType } from "@repo/types";
import { response } from "express";
import { handleCommand } from "./src/controller/engine.controller";

const client = getRedisClient();
let lastSeenId = '$';
async function startUp() {
  let readRedis = await client;
  let writeRedis = await client;
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
        const request: EngineRequest = {
          correlationId,
          type: type as EngineRequest['type'],
          responseQueue,
          payload: JSON.parse(payload)
        }

        const response = handleCommand(request);

        if (!response) continue;// for update_index_price

        await writeRedis.xAdd(response.responseQueue, '*', {
          correlationId,
          ok: "true",
          data: JSON.stringify(response.data),
        })
        //if not backendOnly so also put in 
        if (response.globalEvent) {
          await writeRedis.xAdd(REDIS_KEYS.engineEvents, '*', {
            correlationId,
            ok: response.ok ? "true" : "false",
            error: response.error ?? '',
            data: response.data ? JSON.stringify(response.data) : ''
          })
        }
      }
    }
  }
}
startUp().catch(() => process.exit(1));
