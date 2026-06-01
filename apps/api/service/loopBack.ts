import { getRedisClient } from "@repo/redis";
import { EngineCommandType, EnginePayload, EngineResponse, REDIS_KEYS } from "@repo/types";

const clientPromise = getRedisClient();

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

const loopbackResponses = new Map<string, PendingRequest>();
const responseBe = crypto.randomUUID();
let lastGlobalId = '$';
let lastBackendId = '$';

export const loopback = async (type: EngineCommandType, payload: EnginePayload) => {
  const correlationId = crypto.randomUUID();

  return new Promise(async (resolve, reject) => {
    const redis = await clientPromise;

    const timeout = setTimeout(() => {
      loopbackResponses.delete(correlationId);
      reject(new Error("Engine response timed out"));
    }, 10_000);

    loopbackResponses.set(correlationId, { resolve, reject, timeout });

    try {
      await redis.xAdd(REDIS_KEYS.engineCommands, '*', {
        type,
        correlationId,
        responseQueue: REDIS_KEYS.responseQueue(responseBe),
        payload: JSON.stringify(payload),
      });
    } catch {
      clearTimeout(timeout);
      loopbackResponses.delete(correlationId);
      reject(new Error("Failed to send to engine"));
    }
  })
}

async function waitForResponse() {
  const redis = await clientPromise;

  while (true) {
    const streams = await redis.xRead([
      { key: REDIS_KEYS.engineEvents, id: lastGlobalId },
      { key: REDIS_KEYS.responseQueue(responseBe), id: lastBackendId },
    ], { BLOCK: 0, COUNT: 1 })

    if (!streams) continue;

    for (const stream of streams) {
      for (const msg of stream.messages) {
        if (stream.name === REDIS_KEYS.engineEvents) {
          lastGlobalId = msg.id;
        } else {
          lastBackendId = msg.id;
        }

        const engineResponse: EngineResponse = msg.message;
        const pending = loopbackResponses.get(engineResponse.correlationId);
        if (!pending) continue;

        clearTimeout(pending.timeout);
        !engineResponse.ok
          ? pending.reject(new Error(engineResponse.error))
          : pending.resolve(engineResponse.data);
        loopbackResponses.delete(engineResponse.correlationId);
      }
    }
  }
}

waitForResponse().catch(() => process.exit(1));
