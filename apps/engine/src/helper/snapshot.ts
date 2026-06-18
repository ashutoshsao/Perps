import { Balance, Fill, Market, OrderRecord, Position, RestingOrder } from "@repo/types";
import { BALANCES, FILLS, INDEX_PRICES, MARKETS, ORDERBOOKS, ORDERS, POSITIONS } from "../engine-store";
import fs from "fs/promises";
import BTree from "sorted-btree";

const SNAPSHOT_DIR = "../../data/snapshots";
const MAX_SNAPSHOTS = 10;

export async function saveSnapshot(lastSeenStreamId: string) {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

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
      asks.push([price, orders])
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

  const snapshot = {
    lastSeenStreamId,
    takenAt: Date.now(),
    state: {
      orderbooks: serializedOrderbooks,
      orders: Object.fromEntries(ORDERS),
      positions: serializedPositions,
      balances: serializedbalances,
      fills: Object.fromEntries(FILLS),
      markets: Object.fromEntries(MARKETS),
      index_prices: Object.fromEntries(INDEX_PRICES)
    }
  }

  const tmpPath = `${SNAPSHOT_DIR}/.tmp_${lastSeenStreamId}.json`;
  const finalPath = `${SNAPSHOT_DIR}/${lastSeenStreamId}.json`;
  await fs.writeFile(tmpPath, JSON.stringify(snapshot));
  await fs.rename(tmpPath, finalPath);

  await cleanupOldSnapshots();
}

export async function loadSnapshot(): Promise<string> {
  try {
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

    //find all snapshot fills
    const files = await fs.readdir(SNAPSHOT_DIR);
    const snapshots = files
      .filter(f => f.endsWith('.json') && !f.startsWith('.tmp'))
      .sort();
    if (snapshots.length === 0) return '0-0';

    //load latest
    const latest = snapshots[snapshots.length - 1];
    const content = await fs.readFile(`${SNAPSHOT_DIR}/${latest}`, 'utf-8');
    const { lastSeenStreamId, state } = JSON.parse(content);

    // restore state

    // orderbooks
    for (const [orderId, order] of Object.entries(state.orders)) {
      ORDERS.set(orderId, order as OrderRecord)
    }

    //markets
    for (const [symbol, market] of Object.entries(state.markets)) {
      MARKETS.set(symbol, market as Market)
    }

    //fills
    for (const [symbol, fills] of Object.entries(state.fills)) {
      FILLS.set(symbol, fills as Fill[]);
    }

    //index_prices
    for (const [symbol, price] of Object.entries(state.index_prices)) {
      INDEX_PRICES.set(symbol, price as number);
    }

    //positions
    const positions = state.positions as Record<string, Record<string, Position>>;
    for (const [userId, innerObj] of Object.entries(positions)) {
      let innetMap = new Map<string, Position>();
      for (const [symbol, pos] of Object.entries(innerObj)) {
        innetMap.set(symbol, pos);
      }
      POSITIONS.set(userId, innetMap);
    }

    //balances
    const balances = state.balances as Record<string, Record<string, Balance>>;
    for (const [userId, innerObj] of Object.entries(balances)) {
      let innetMap = new Map<string, Balance>();
      for (const [symbol, bal] of Object.entries(innerObj)) {
        innetMap.set(symbol, bal);
      }
      BALANCES.set(userId, innetMap);
    }

    //orderbooks
    type SerializedOrderbooks = {
      asks: [number, RestingOrder[]][];
      bids: [number, RestingOrder[]][];
      lastTradedPrice: number;
    }
    const orderbooks = state.orderbooks as Record<string, SerializedOrderbooks>;
    for (const [symbol, saved] of Object.entries(orderbooks)) {
      const asks = new BTree<number, RestingOrder[]>();
      const bids = new BTree<number, RestingOrder[]>();

      for (const [price, orders] of saved.asks) {
        asks.set(price, orders);
      }

      for (const [price, orders] of saved.bids) {
        bids.set(price, orders);
      }

      ORDERBOOKS.set(symbol, {
        asks,
        bids,
        lastTradedPrice: saved.lastTradedPrice
      })
    }


    return lastSeenStreamId;
  } catch (error) {
    console.log(`Error while saving snapshot ${(error as Error).message}`);
    return '0-0';
  }
}

async function cleanupOldSnapshots() {
  const files = await fs.readdir(SNAPSHOT_DIR);
  const snapshot = files
    .filter(f => f.endsWith(`.json`) && !f.startsWith(`.tmp`))
    .sort()

  if (snapshot.length > MAX_SNAPSHOTS) {
    const toDelete = snapshot.slice(0, snapshot.length - MAX_SNAPSHOTS);
    for (const file of toDelete) {
      await fs.unlink(`${SNAPSHOT_DIR}/${file}`);
    }
  }
}
