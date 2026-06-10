import { Balance, Position, RestingOrder } from "@repo/types";
import { BALANCES, FILLS, INDEX_PRICES, MARKETS, ORDERBOOKS, ORDERS, POSITIONS } from "../engine-store";
import fs from "fs";

const SNAPSHOT_DIR = "../../data/snapshots";
const MAX_SNAPSHOTS = 10;

export async function snapshot(lastSeenStreamId: string) {
  let serializedPositions: Record<string, Record<string, Position>> = {};
  for (const [userId, innerMap] of POSITIONS) {
    serializedPositions[userId] = Object.fromEntries(innerMap)
  }

  let serializedbalances: Record<string, Record<string, Balance>> = {};
  for (const [userId, innerMap] of BALANCES) {
    serializedbalances[userId] = Object.fromEntries(innerMap)
  }

  let serializedOrderbooks: Record<string, {
    bids: [number, RestingOrder[]][],
    asks: [number, RestingOrder[]][],
    lastTradedPrice: number
  }> = {};

  for (const [symbol, ob] of ORDERBOOKS) {
    const asks: [number, RestingOrder[]][] = []
    const bids: [number, RestingOrder[]][] = []

    ob.asks.forEachPair((price, orders) => {
      bids.push([price, orders])
    })
    ob.bids.forEachPair((price, orders) => {
      bids.push([price, orders])
    })

    serializedOrderbooks[symbol] = {
      asks,
      bids,
      lastTradedPrice: ob.lastTradedPrice
    }
  }

  const serializedEngine = {
    orderbooks: Object.fromEntries(ORDERBOOKS),
    orders: Object.fromEntries(ORDERS),
    positions: serializedPositions,
    balances: serializedbalances,
    fills: Object.fromEntries(FILLS),
    markets: Object.fromEntries(MARKETS),
    index_prices: Object.fromEntries(INDEX_PRICES)
  }
}

export async function loadSnapshot() {
  function promisifiedReadFile(path: string) {
    return new Promise((resolve, reject) => {
      fs.readFile(path, "utf-8", (err, data) => {
        if (err) reject((err as Error).message);
        resolve(data);
      })
    })
  }
  try {
    const response = await promisifiedReadFile(SNAPSHOT_DIR);

  } catch (error) {

  }
}
