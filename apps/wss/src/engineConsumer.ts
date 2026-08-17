import { getRedisClient } from "@repo/redis";
import { CancelOrderResponse, CreateOrderResponse, FundingRateResponse, REDIS_KEYS, RedisResponseType, UpdateIndexPriceResponse } from "@repo/types";

const WSS_EVENTS = new Set(["create_order", "cancel_order", "funding_rate", "update_index_price"]);
const GROUP = "wss"
const CONSUMER = `wss-${crypto.randomUUID()}`;
const CLAIM_IDLE_MS = 30_000;


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

  async function handleMessage(id: string, message: Record<string, string>) {
    const type = message.type
    const ok = message.ok === 'true'

    if (!WSS_EVENTS.has(type) || !ok) {
      await readClient.xAck(REDIS_KEYS.engineEvents, GROUP, id)
      return
    }
    if (type === "create_order") {
      //create_order
      const data = JSON.parse(message.data) as CreateOrderResponse;
      await publishCreateOrderEvent(data);
    }
    else if (type === "cancel_order") {
      //cancel_order
      const data = JSON.parse(message.data) as CancelOrderResponse;

      await publishClient.publish(`market:${data.order.symbol}:depth`, JSON.stringify(data.depthDiff))

      await publishClient.publish(`user:${data.order.userId}:orders`, JSON.stringify(data.order))
    }
    else if (type === "funding_rate") {
      const { rates, settlements } = JSON.parse(message.data) as FundingRateResponse;

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
      const { events } = JSON.parse(message.data) as UpdateIndexPriceResponse;

      for (const event of events) {
        await publishCreateOrderEvent(event)
        if (event.reason) {
          await publishClient.publish(`user:${event.order.userId}:notifications`, JSON.stringify({
            type: event.reason, symbol: event.order.symbol, qty: event.order.qty
          }))
        }
      }
    }
    await readClient.xAck(REDIS_KEYS.engineEvents, GROUP, id)
  }

  // reclaims entries left pending by consumers that crashed/restarted before acking —
  // previously this just discarded them unread on startup
  async function claimStale() {
    let cursor = '0-0'
    do {
      const result = await readClient.xAutoClaim(REDIS_KEYS.engineEvents, GROUP, CONSUMER, CLAIM_IDLE_MS, cursor, { COUNT: 100 })
      for (const msg of result.messages) {
        if (!msg) continue
        await handleMessage(msg.id, msg.message)
      }
      cursor = result.nextId
    } while (cursor !== '0-0')
  }

  try {
    await readClient.xGroupCreate(REDIS_KEYS.engineEvents, GROUP, '0', { MKSTREAM: true })
  } catch {
    // group already exists — fine
  }

  await claimStale()
  setInterval(() => claimStale().catch((err) => console.error("claimStale failed:", err)), CLAIM_IDLE_MS)

  while (true) {
    const streams = await readClient.xReadGroup(GROUP, CONSUMER, [{ key: REDIS_KEYS.engineEvents, id: ">" }], {
      BLOCK: 0,
      COUNT: 1
    }) as RedisResponseType | null;
    if (!streams) continue;
    for (const stream of streams) {
      for (const msg of stream.messages) {
        await handleMessage(msg.id, msg.message)
      }
    }
  }
}
readEngineEmits().catch(() => process.exit(1))
