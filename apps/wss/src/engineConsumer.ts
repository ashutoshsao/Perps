import { getRedisClient } from "@repo/redis";
import { CancelOrderResponse, CreateOrderResponse, FundingRateResponse, REDIS_KEYS, RedisResponseType, UpdateIndexPriceResponse } from "@repo/types";

const WSS_EVENTS = new Set(["create_order", "cancel_order", "funding_rate", "update_index_price"]);
const GROUP = "wss"
const CONSUMER = `wss-${crypto.randomUUID()}`;


export async function readEngineEmits() {

  const readClient = await getRedisClient();
  const publishClient = await getRedisClient();

  async function publishCreateOrderEvent(data: CreateOrderResponse) {
    await publishClient.publish(`market:${data.order.symbol}:depth`, JSON.stringify(data.depthDiff))
    for (const fill of data.fills) {
      await publishClient.publish(`market:${fill.symbol}:trade`, JSON.stringify({
        symbol: fill.symbol,
        price: fill.price,
        qty: fill.qty,
        side: fill.makerSide === "buy" ? "sell" : "buy",
        createdAt: fill.createdAt
      }))
      await publishClient.publish(`user:${fill.takerUserId}:fills`, JSON.stringify(fill))
      await publishClient.publish(`user:${fill.makerUserId}:fills`, JSON.stringify(fill))
    }

    await publishClient.publish(`user:${data.order.userId}:orders`, JSON.stringify(data.order))

    for (const order of data.makerOrders) {
      await publishClient.publish(`user:${order.userId}:orders`, JSON.stringify(order))
    }
  }

  try {
    await readClient.xGroupCreate(REDIS_KEYS.engineEvents, GROUP, '0', { MKSTREAM: true })
  } catch {
    // group already exists — fine
  }

  // acknowledge stale pending messages on startup
  while (true) {
    const pending = await readClient.xPendingRange(REDIS_KEYS.engineEvents, GROUP, '-', '+', 100)
    if (pending.length === 0) break
    for (const msg of pending) {
      await readClient.xAck(REDIS_KEYS.engineEvents, GROUP, msg.id)
    }
  }

  while (true) {
    const streams = await readClient.xReadGroup(GROUP, CONSUMER, [{ key: REDIS_KEYS.engineEvents, id: ">" }], {
      BLOCK: 0,
      COUNT: 1
    }) as RedisResponseType | null;
    if (!streams) continue;
    for (const stream of streams) {
      for (const msg of stream.messages) {
        const type = msg.message.type
        const ok = msg.message.ok === 'true'

        if (!WSS_EVENTS.has(type) || !ok) {
          await readClient.xAck(REDIS_KEYS.engineEvents, GROUP, msg.id)
          continue
        }
        if (type === "create_order") {
          //create_order
          const data = JSON.parse(msg.message.data) as CreateOrderResponse;
          await publishCreateOrderEvent(data);
        }
        else if (type === "cancel_order") {
          //cancel_order
          const data = JSON.parse(msg.message.data) as CancelOrderResponse;

          await publishClient.publish(`market:${data.order.symbol}:depth`, JSON.stringify(data.depthDiff))

          await publishClient.publish(`user:${data.order.userId}:orders`, JSON.stringify(data.order))
        }
        else if (type === "funding_rate") {
          const { rates, settlements } = JSON.parse(msg.message.data) as FundingRateResponse;

          for (const { symbol, rate, settledAt } of rates) {
            await publishClient.publish(`market:${symbol}:funding`, JSON.stringify({ symbol, rate, settledAt }))
          }

          for (const settlement of settlements) {
            await publishClient.publish(`user:${settlement.userId}:funding`, JSON.stringify(settlement))
          }
        }
        else if (type === "update_index_price") {
          // mark price is published straight from the engine via pub/sub — this
          // stream branch only ever sees ticks carrying liquidation/ADL events
          const { events } = JSON.parse(msg.message.data) as UpdateIndexPriceResponse;

          for (const event of events) {
            await publishCreateOrderEvent(event)
            if (event.reason) {
              await publishClient.publish(`user:${event.order.userId}:notifications`, JSON.stringify({
                type: event.reason, symbol: event.order.symbol, qty: event.order.qty
              }))
            }
          }
        }
        await readClient.xAck(REDIS_KEYS.engineEvents, GROUP, msg.id)
      }
    }
  }
}
readEngineEmits().catch(() => process.exit(1))
