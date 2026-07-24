import { getRedisClient } from "@repo/redis";
import { CancelOrderResponse, CreateOrderResponse, EngineRequest, OrderRecord, REDIS_KEYS, RedisResponseType, UpdateIndexPriceResponse } from "@repo/types";
import { handleCommand } from "./src/controller/engine.controller";
import { loadSnapshot, saveSnapshot } from "./src/helper/snapshot";
import { ORDERS } from "./src/engine-store";
const readClient = getRedisClient()
const writeClient = getRedisClient()
type RedisClient = Awaited<ReturnType<typeof getRedisClient>>

function evictIfTerminal(order: OrderRecord | undefined) {
  if (!order) return;
  if (order.status === "filled" || order.status === "cancelled") {
    ORDERS.delete(order.orderId);
  }
}
const GLOBAL_EVENTS = new Set([
  "funding_rate",
  "create_order",
  "cancel_order",
  "create_market"
])

let lastSeenId: string
let lastSnapshotTime = Date.now()

//snapshot every 5 mins
const SNAPSHOT_INTERVAL = 5 * 60 * 1000

//universal funding_rate times
const FUNDING_TIMES_UTC_HOURS = [0, 8, 16];

async function startUp() {
  //loadSnapshot
  lastSeenId = await loadSnapshot();
  let readRedis = await readClient;
  let writeRedis = await writeClient;

  scheduleFundingRate(writeRedis);
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
            streamMsgId: msg.id,
            correlationId,
            type: type as EngineRequest['type'],
            responseQueue,
            payload: JSON.parse(payload)
          }

          const response = handleCommand(request);

          if (!response) continue;

          if (type === "update_index_price") {
            const { symbol, markPrice, events } = response as UpdateIndexPriceResponse;

            // mark price is ephemeral — fire-and-forget pub/sub, never the durable event log
            const time = parseInt(`${msg.id.split("-")[0]}`);
            await writeRedis.publish(`market:${symbol}:markPrice`, JSON.stringify({
              symbol,
              price: markPrice,
              time
            }))

            // the durable stream only sees ticks that carry liquidation/ADL events
            if (events.length > 0) {
              await writeRedis.xAdd(REDIS_KEYS.engineEvents, '*', {
                type,
                correlationId,
                ok: 'true',
                error: '',
                data: JSON.stringify(response),
              })

              for (const event of events) {
                evictIfTerminal(event.order);
                event.makerOrders.forEach(evictIfTerminal);
              }
            }
            continue;
          }

          if (GLOBAL_EVENTS.has(type)) {
            // create_order, cancel_order, create_market,
            await writeRedis.xAdd(REDIS_KEYS.engineEvents, '*', {
              type,
              correlationId,
              ok: 'true',
              error: '',
              data: JSON.stringify(response),
            })

            if (type === "create_order") {
              const { order, makerOrders } = response as CreateOrderResponse;
              evictIfTerminal(order);
              makerOrders.forEach(evictIfTerminal);
            } else if (type === "cancel_order") {
              const { order } = response as CancelOrderResponse;
              evictIfTerminal(order);
            }
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
    if (Date.now() - lastSnapshotTime > SNAPSHOT_INTERVAL) {
      await saveSnapshot(lastSeenId)
      lastSnapshotTime = Date.now()
    }
  }
}

function msUntilNextFunding(): number {
  const now = new Date()
  const currentHour = now.getUTCHours()

  const nextHour = FUNDING_TIMES_UTC_HOURS.find(h => h > currentHour) ?? FUNDING_TIMES_UTC_HOURS[0];
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    nextHour, 0, 0, 0
  ))

  if (nextHour <= currentHour) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}

function scheduleFundingRate(writeRedis: RedisClient) {
  setTimeout(async function trigger() {
    await writeRedis.xAdd(REDIS_KEYS.engineCommands, '*', {
      type: "funding_rate",
      correlationId: crypto.randomUUID(),
      responseQueue: '',
      payload: JSON.stringify({})
    })
    scheduleFundingRate(writeRedis);
  }, msUntilNextFunding())
}

startUp().catch((err) => {
  console.error("Engine crashed:", err);
  process.exit(1);
});

