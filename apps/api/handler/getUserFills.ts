import { getUserFillsApiSchema } from "@repo/types";
import { prisma } from "@repo/db";
import { Request, Response } from "express";

export async function getUserFills(req: Request, res: Response) {
  const userId = req.userId!;
  const parsed = getUserFillsApiSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid inputs" })
    return
  }
  const { limit, cursor } = parsed.data;

  try {
    const rows = await prisma.fill.findMany({
      where: {
        OR: [
          { takerUserId: userId },
          { makerUserId: userId }
        ]
      },
      include: {
        makerOrder: {
          select: {
            side: true,
            market: { select: { symbol: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit;
    const fills = hasMore ? rows.slice(0, limit) : rows;

    const userFills = fills.map((fill) => {
      const makerSide = fill.makerOrder.side;
      const isMaker = fill.makerUserId === userId;
      const side = isMaker ? makerSide : makerSide === "buy" ? "sell" : "buy";

      return {
        id: fill.id,
        qty: fill.qty,
        price: fill.price,
        side,
        makerSide,
        symbol: fill.makerOrder.market.symbol,
        makerUserId: fill.makerUserId,
        takerUserId: fill.takerUserId,
        makerOrderId: fill.makerOrderId,
        takerOrderId: fill.takerOrderId,
        marketId: fill.marketId,
        createdAt: fill.createdAt,
      };
    });

    res.status(200).json({
      fills: userFills,
      nextCursor: hasMore ? fills[fills.length - 1]!.id : null,
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
