import { getUserOrdersApiSchema } from "@repo/types";
import { prisma } from "@repo/db";
import { Request, Response } from "express";

export async function getUserOrders(req: Request, res: Response) {
  const userId = req.userId!;
  const parsed = getUserOrdersApiSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid inputs" })
    return
  }
  const { limit, cursor } = parsed.data;

  try {
    const rows = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit;
    const orders = hasMore ? rows.slice(0, limit) : rows;

    res.status(200).json({
      orders,
      nextCursor: hasMore ? orders[orders.length - 1]!.id : null,
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
