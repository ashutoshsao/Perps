import { CancelOrderResponse, CreateOrderResponse } from "@repo/types"
import { insertFill, prisma } from "@repo/db"

export async function updateDb(type: string, data: unknown) {
  if (type === "cancel_order") {
    const { order } = data as CancelOrderResponse
    await prisma.order.update({
      where: { id: order.orderId },
      data: { status: "cancelled" }
    })

  } else if (type === "create_order") {
    const { order, makerOrders } = data as CreateOrderResponse

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

    for (const makerOrder of makerOrders) {
      await prisma.order.upsert({
        where: { id: makerOrder.orderId },
        create: {
          id: makerOrder.orderId,
          userId: makerOrder.userId,
          marketId: makerOrder.marketId,
          orderType: makerOrder.orderType,
          side: makerOrder.side,
          qty: makerOrder.qty,
          filledQty: makerOrder.filledQty,
          price: makerOrder.price,
          leverage: makerOrder.leverage,
          initialMargin: makerOrder.margin,
          status: makerOrder.status,
        },
        update: {
          filledQty: makerOrder.filledQty,
          status: makerOrder.status,
        }
      })
    }

    for (const fill of order.fills) {
      const existing = await prisma.fill.findUnique({ where: { id: fill.fillId } })

      if (!existing) {
        await prisma.$transaction(async (tx) => {
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
  }
}
