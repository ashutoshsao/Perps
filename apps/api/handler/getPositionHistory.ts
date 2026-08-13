import { getPositionHistoryApiSchema } from "@repo/types"
import { prisma } from "@repo/db"
import { Request, Response } from "express"

export async function getPositionHistory(req: Request, res: Response) {
  const userId = req.userId!;
  const parsed = getPositionHistoryApiSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Inputs" })
    return
  }
  const { symbol, limit, cursor } = parsed.data;

  try {
    const rows = await prisma.closedPosition.findMany({
      where: { userId, ...(symbol ? { symbol } : {}) },
      orderBy: { closedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit;
    const positions = hasMore ? rows.slice(0, limit) : rows;

    res.status(200).json({
      positions,
      nextCursor: hasMore ? positions[positions.length - 1]!.id : null,
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
