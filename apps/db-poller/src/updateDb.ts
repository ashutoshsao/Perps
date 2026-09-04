import { CancelOrderResponse, CreateOrderResponse, FundingRateResponse, OrderRecord, UpdateIndexPriceResponse } from "@repo/types"
import { insertFill, prisma, Prisma } from "@repo/db"

async function upsertOrder(order: OrderRecord) {
  try {
    await prisma.order.upsert({
      where: { id: order.orderId },
      create: {
        id: order.orderId,
        userId: order.userId,
        marketId: order.marketId,
        orderType: order.orderType,
        side: order.side,
        qty: order.qty,
        filledQty: order.filledQty,
        price: order.price,
        leverage: order.leverage,
        initialMargin: order.margin,
        status: order.status,
      },
      update: {
        filledQty: order.filledQty,
        status: order.status,
      }
    })
  } catch (err) {
    // e.g. userId with no matching User row (stale JWT for a deleted account) —
    // the engine already accepted the order in memory, so this write can never
    // succeed; log and move on rather than jamming this stream message forever
    console.error(`Failed to persist order ${order.orderId}:`, err)
  }
}

async function persistCreateOrderEvent(data: CreateOrderResponse) {
  const { order, makerOrders } = data as CreateOrderResponse

  await upsertOrder(order)
  for (const makerOrder of makerOrders) {
    await upsertOrder(makerOrder)
  }

  for (const fill of order.fills) {
    try {
      await prisma.$transaction(async (tx) => {
        try {
          await tx.fill.create({
            data: {
              id: fill.fillId,
              qty: fill.qty,
              price: fill.price,
              makerUserId: fill.makerUserId,
              takerUserId: fill.takerUserId,
              makerOrderId: fill.makerOrderId,
              takerOrderId: fill.takerOrderId,
              marketId: order.marketId,
            }
          })
        } catch (err) {
          // concurrent/replayed delivery of the same event already recorded this fill
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return
          throw err
        }

        const makerOrder = makerOrders.find((order) => order.orderId === fill.makerOrderId)
        if (makerOrder) {
          await tx.order.update({
            where: { id: fill.makerOrderId },
            data: {
              filledQty: makerOrder.filledQty,
              status: makerOrder.status,
            }
          })
        }
      })
    } catch (err) {
      // e.g. a maker/taker userId with no matching User row — the fill already
      // happened in the engine, so this write can never succeed; log and move on
      // rather than jamming this stream message forever
      console.error(`Failed to persist fill ${fill.fillId}:`, err)
      continue
    }

    await insertFill(
      fill.fillId,
      order.symbol,
      fill.price,
      fill.qty,
      fill.makerSide === "buy" ? "sell" : "buy",
      fill.createdAt
    )
  }

  for (const close of data.closedPositions ?? []) {
    try {
      await prisma.closedPosition.upsert({
        where: { id: close.closeId },
        create: {
          id: close.closeId,
          userId: close.userId,
          marketId: order.marketId,
          symbol: close.symbol,
          positionSide: close.positionSide,
          closeType: close.closeType,
          entryPrice: close.entryPrice,
          exitPrice: close.exitPrice,
          qty: close.qty,
          realizedPnl: close.realizedPnl,
          marginReleased: close.marginReleased,
          openedAt: new Date(close.openedAt),
          closedAt: new Date(close.closedAt),
        },
        update: {},
      })
    } catch (err) {
      // one bad close shouldn't block the rest of this event's writes from persisting
      console.error(`Failed to persist closed position ${close.closeId}:`, err)
    }
  }
}

export async function updateDb(type: string, data: unknown) {
  if (type === "cancel_order") {
    const { order } = data as CancelOrderResponse
    try {
      await prisma.order.update({
        where: { id: order.orderId },
        data: { status: "cancelled" }
      })
    } catch (err) {
      // the order row may never have been persisted (e.g. its own create_order
      // event failed with an orphaned userId) — nothing to mark cancelled
      console.error(`Failed to persist cancellation for order ${order.orderId}:`, err)
    }

  } else if (type === "create_order") {
    await persistCreateOrderEvent(data as CreateOrderResponse);
  } else if (type === "funding_rate") {
    const { rates, settlements } = data as FundingRateResponse;

    for (const rateSnapshot of rates) {
      try {
        const market = await prisma.market.findUnique({
          where: { symbol: rateSnapshot.symbol }
        })
        if (!market) continue;

        await prisma.fundingRate.upsert({
          where: { symbol_settledAt: { symbol: rateSnapshot.symbol, settledAt: new Date(rateSnapshot.settledAt) } },
          create: {
            marketId: market.id,
            symbol: rateSnapshot.symbol,
            rate: rateSnapshot.rate,
            settledAt: new Date(rateSnapshot.settledAt)
          },
          update: {},
        })
      } catch (err) {
        console.error(`Failed to persist funding rate for ${rateSnapshot.symbol}:`, err)
      }
    }

    for (const settlement of settlements) {
      try {
        await prisma.fundingSettlement.upsert({
          where: {
            userId_symbol_settledAt: {
              userId: settlement.userId,
              symbol: settlement.symbol,
              settledAt: new Date(settlement.settledAt)
            }
          },
          create: {
            userId: settlement.userId,
            symbol: settlement.symbol,
            rate: settlement.rate,
            payment: settlement.payment,
            marginAfter: settlement.marginAfter,
            liquidationPriceAfter: settlement.liquidationPriceAfter,
            settledAt: new Date(settlement.settledAt),
          },
          update: {},
        })
      } catch (err) {
        console.error(`Failed to persist funding settlement for user ${settlement.userId}/${settlement.symbol}:`, err)
      }
    }
  }
  else if (type === "update_index_price") {
    const { events } = data as UpdateIndexPriceResponse;
    for (const event of events) {
      await persistCreateOrderEvent(event);
    }
  }
}
