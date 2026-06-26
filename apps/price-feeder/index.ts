import WebSocket from "ws"
import { loopback } from "./src/loopBack";
import { newMarket } from "./src/helper/newMarket";
import { getRedisClient } from "@repo/redis";
import { REDIS_KEYS } from "@repo/types";

const readRedis = getRedisClient();
const writeRedis = getRedisClient();
const ws = new WebSocket("wss://fstream.binance.com/market/ws");

export const subscribedMarkets = new Set<string>();

ws.on("open", async () => {
  watchNewMarkets()  // start watching FIRST — don't miss any create_market events
  const markets = await loopback() as string[]  // then get existing markets
  for (const symbol of markets) newMarket(ws, symbol)  // subscribe to all
})

ws.on("message", async (data) => {
  const msg = JSON.parse(data.toString());
  if (!msg.e) return

  const client = await writeRedis;
  await client.xAdd(REDIS_KEYS.engineCommands, '*', {
    type: "update_index_price",
    correlationId: crypto.randomUUID(),
    ResponseQueue: '',
    payload: JSON.stringify({
      symbol: msg.s.replace("USDT", ''),// "SOLUSDT" => "SOL",
      price: Math.floor(parseFloat(msg.i))
    })
  })
})

ws.on("ping", (data) => ws.pong(data))

async function watchNewMarkets() {
  const client = await readRedis
  let lastId = '$'

  while (true) {
    const streams = await client.xRead([
      { key: REDIS_KEYS.engineEvents, id: lastId }
    ], { BLOCK: 0, COUNT: 10 })

    if (!streams) continue

    for (const stream of streams) {
      for (const msg of stream.messages) {
        lastId = msg.id
        if (msg.message.type !== 'create_market') continue
        const data = JSON.parse(msg.message.data)
        newMarket(ws, data.symbol)
      }
    }
  }
}

watchNewMarkets().catch(() => process.exit(1))
