import { OrderRecord } from "@repo/types"
import { prisma } from "@repo/db"

export async function updateDb(type: string, data: unknown) {
  if (type === "cancel_order") {
    const { orderId } = data as OrderRecord
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "cancelled" }
    })

  } else if (type === "create_order") {
    const order = data as OrderRecord

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

    for (const fill of order.fills) {
      const existing = await prisma.fill.findUnique({ where: { id: fill.fillId } })
      if (existing) continue  // already processed — skip

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

        const makerOrder = await tx.order.update({
          where: { id: fill.makerOrderId },
          data: { filledQty: { increment: fill.qty } }
        })

        await tx.order.update({
          where: { id: fill.makerOrderId },
          data: {
            status: makerOrder.filledQty >= makerOrder.qty
              ? "filled"
              : makerOrder.filledQty > 0
                ? "partially_filled"
                : "open"
          }
        })
      })
    }
  }
}
