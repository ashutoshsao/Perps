import { Balance, Market, OrderRecord, Position, RestingOrder } from "@repo/types";
import { BALANCES, INDEX_PRICES, MARKET_UPDATE_IDS, MARKETS, ORDERBOOKS, ORDERS, POSITIONS } from "../engine-store";
import BTree from "sorted-btree";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`env ${name} not present`);
  return value;
}

const R2_BUCKET = getEnv("R2_BUCKET");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${getEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
  },
});

const MAX_SNAPSHOTS = 10;

export async function saveSnapshot(lastSeenStreamId: string) {
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
      markets: Object.fromEntries(MARKETS),
      index_prices: Object.fromEntries(INDEX_PRICES),
      marketUpdateIds: Object.fromEntries(MARKET_UPDATE_IDS)
    }
  }

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: `${lastSeenStreamId}.json`,
    Body: JSON.stringify(snapshot),
    ContentType: "application/json",
  }));

  await cleanupOldSnapshots();
}

async function listSnapshotKeys(): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      ContinuationToken: continuationToken,
    }));
    for (const obj of result.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return keys.sort();
}

export async function loadSnapshot(): Promise<string> {
  try {
    const snapshots = await listSnapshotKeys();
    if (snapshots.length === 0) return '0-0';

    //load latest
    const latest = snapshots[snapshots.length - 1]!;
    const object = await r2.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: latest,
    }));
    const content = await object.Body!.transformToString();
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

    //index_prices
    for (const [symbol, price] of Object.entries(state.index_prices)) {
      INDEX_PRICES.set(symbol, price as number);
    }

    //marketUpdateIds
    for (const [symbol, id] of Object.entries(state.marketUpdateIds)) {
      MARKET_UPDATE_IDS.set(symbol, id as number)
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
    console.log(`Error while loading snapshot ${(error as Error).message}`);
    return '0-0';
  }
}

async function cleanupOldSnapshots() {
  const snapshots = await listSnapshotKeys();

  if (snapshots.length > MAX_SNAPSHOTS) {
    const toDelete = snapshots.slice(0, snapshots.length - MAX_SNAPSHOTS);
    await r2.send(new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: { Objects: toDelete.map(Key => ({ Key })) },
    }));
  }
}
