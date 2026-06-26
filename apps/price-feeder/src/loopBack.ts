import { getRedisClient } from "@repo/redis";
import { EngineResponse, REDIS_KEYS } from "@repo/types";

const writeClientPromise = getRedisClient();
const readClientPromise = getRedisClient();

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

const loopbackResponses = new Map<string, PendingRequest>();

const responseBe = crypto.randomUUID();
let lastBackendId = '$';
let lastGlobalId = '$';
export const loopback = async () => {
  const correlationId = crypto.randomUUID();

  return new Promise(async (resolve, reject) => {
    const redis = await writeClientPromise;

    const timeout = setTimeout(() => {
      loopbackResponses.delete(correlationId);
      reject(new Error("Engine response timed out"));
    }, 10_000);

    loopbackResponses.set(correlationId, { resolve, reject, timeout });

    try {
      await redis.xAdd(REDIS_KEYS.engineCommands, '*', {
        type: "get_markets",
        correlationId,
        responseQueue: REDIS_KEYS.responseQueue(responseBe),
        payload: JSON.stringify({}),
      });
    } catch (err) {
      clearTimeout(timeout);
      loopbackResponses.delete(correlationId);
      reject(new Error("Failed to send to engine"));
    }
  })
}

async function waitForResponse() {
  const redis = await readClientPromise
  while (true) {
    const streams = await redis.xRead([
      { key: REDIS_KEYS.responseQueue(responseBe), id: lastBackendId },
    ], { BLOCK: 0, COUNT: 1 })
    if (!streams) continue
    for (const stream of streams) {
      for (const msg of stream.messages) {
        lastBackendId = msg.id
        const raw: EngineResponse = {
          type: msg.message.type,
          correlationId: msg.message.correlationId,
          ok: msg.message.ok === 'true',
          data: msg.message.data ? JSON.parse(msg.message.data) : undefined,
          error: msg.message.error || undefined,
        }
        const pending = loopbackResponses.get(raw.correlationId)
        if (!pending) continue
        clearTimeout(pending.timeout)
        raw.ok
          ? pending.resolve(raw.data)
          : pending.reject(new Error(raw.error ?? "Engine error"))
        loopbackResponses.delete(raw.correlationId)
      }
    }
  }
}

waitForResponse().catch((err) => {
  console.error("Loopback response listener crashed:", err);
  process.exit(1);
});
