import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "@repo/db";
import type { CreateOrderResponse } from "@repo/types";
import { updateDb } from "./updateDb";

const marketId = crypto.randomUUID();
const makerUserId = crypto.randomUUID();
const takerUserId = crypto.randomUUID();
const makerOrderId = crypto.randomUUID();
const takerOrderId = crypto.randomUUID();
const fillId = crypto.randomUUID();

beforeAll(async () => {
  await prisma.market.create({
    data: { id: marketId, symbol: `TEST-${marketId.slice(0, 8)}`, imageUrl: "", maxLeverage: 10, minQty: 1 },
  });
  await prisma.user.createMany({
    data: [
      { id: makerUserId, username: `maker-${makerUserId.slice(0, 8)}`, password: "x" },
      { id: takerUserId, username: `taker-${takerUserId.slice(0, 8)}`, password: "x" },
    ],
  });
  await prisma.order.createMany({
    data: [
      {
        id: makerOrderId, userId: makerUserId, marketId, orderType: "limit", side: "sell",
        qty: 1, filledQty: 0, price: 100, leverage: 1, initialMargin: 100, status: "open",
      },
      {
        id: takerOrderId, userId: takerUserId, marketId, orderType: "market", side: "buy",
        qty: 1, filledQty: 0, price: 100, leverage: 1, initialMargin: 100, status: "open",
      },
    ],
  });
});

afterAll(async () => {
  await prisma.fill.deleteMany({ where: { id: fillId } });
  await prisma.order.deleteMany({ where: { id: { in: [makerOrderId, takerOrderId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [makerUserId, takerUserId] } } });
  await prisma.market.deleteMany({ where: { id: marketId } });
});

function buildEvent(): CreateOrderResponse {
  const fill = {
    fillId, makerUserId, takerUserId, makerOrderId, takerOrderId,
    makerSide: "sell" as const, qty: 1, price: 100, symbol: "TEST", createdAt: Date.now(),
  };

  return {
    order: {
      orderId: takerOrderId, marketId, side: "buy", orderType: "market", status: "filled",
      userId: takerUserId, symbol: "TEST", qty: 1, filledQty: 1, margin: 100, leverage: 1,
      price: 100, fills: [fill], createdAt: Date.now(),
    },
    fills: [fill],
    makerOrders: [{
      orderId: makerOrderId, marketId, side: "sell", orderType: "limit", status: "filled",
      userId: makerUserId, symbol: "TEST", qty: 1, filledQty: 1, margin: 100, leverage: 1,
      price: 100, fills: [fill], createdAt: Date.now(),
    }],
    depthDiff: { symbol: "TEST", firstUpdateId: 1, finalUpdateId: 1, prevUpdateId: 0, bids: [], asks: [] },
  };
}

test("the same fill delivered concurrently is deduped instead of poisoning the message", async () => {
  const event = buildEvent();

  // Simulates two consumers (or a self-claim reclaim racing the original delivery)
  // processing the same event at once — this used to throw a P2002 on the loser.
  await Promise.all([
    updateDb("create_order", event),
    updateDb("create_order", event),
  ]);

  const fills = await prisma.fill.findMany({ where: { id: fillId } });
  expect(fills).toHaveLength(1);

  const makerOrder = await prisma.order.findUniqueOrThrow({ where: { id: makerOrderId } });
  expect(makerOrder.filledQty).toBe(1);
  expect(makerOrder.status).toBe("filled");
});
