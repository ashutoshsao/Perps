import WebSocket from "ws"
import { loopback } from "./src/loopBack";
import { getFeedSymbolForMarketSymbol, getMarketSymbolForFeedSymbol, newMarket, subscribedMarkets } from "./src/helper/newMarket";
import { getRedisClient } from "@repo/redis";
import { REDIS_KEYS } from "@repo/types";

const readRedis = getRedisClient();
const writeRedis = getRedisClient();
const ws = new WebSocket("wss://fstream.binance.com/market/ws");
const enableRestFallback = process.env.PRICE_FEEDER_REST_FALLBACK === "true";
let restPollStarted = false;

ws.on("open", async () => {
  watchNewMarkets()  // start watching FIRST — don't miss any create_market events
  const markets = await loopback() as string[]  // then get existing markets
  for (const symbol of markets) newMarket(ws, symbol)  // subscribe to all
  if (enableRestFallback) startPremiumIndexPoll()
})

ws.on("message", async (data) => {
  const msg = JSON.parse(data.toString())
  if (!msg.e) return

  const symbol = getMarketSymbolForFeedSymbol(msg.s)
  if (!symbol) return

  const price = Math.floor(parseFloat(msg.i) * 1_000_000)
  await publishMarkPrice(symbol, price, msg.E)
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
        if (enableRestFallback) startPremiumIndexPoll()
      }
    }
  }
}

async function publishMarkPrice(symbol: string, price: number, time: number) {
  const client = await writeRedis;
  await client.xAdd(REDIS_KEYS.engineCommands, '*', {
    type: 'update_index_price',
    correlationId: crypto.randomUUID(),
    responseQueue: '',
    payload: JSON.stringify({ symbol, price })
  })

  await client.publish(`market:${symbol}:markPrice`, JSON.stringify({
    symbol,
    price,
    time
  }))
}

function startPremiumIndexPoll() {
  if (restPollStarted) return;
  restPollStarted = true;
  void pollPremiumIndex();
  setInterval(() => {
    void pollPremiumIndex();
  }, 3_000);
}

async function pollPremiumIndex() {
  for (const symbol of subscribedMarkets) {
    const feedSymbol = getFeedSymbolForMarketSymbol(symbol);
    try {
      const response = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${feedSymbol}`);
      if (!response.ok) continue;
      const data = await response.json() as { markPrice?: string; time?: number };
      const markPrice = Number(data.markPrice);
      if (!Number.isFinite(markPrice) || markPrice <= 0) continue;
      await publishMarkPrice(symbol, Math.floor(markPrice * 1_000_000), data.time ?? Date.now());
    } catch {
      // Keep the websocket feeder alive if the REST fallback misses a poll.
    }
  }
}
