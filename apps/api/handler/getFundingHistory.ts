import { getFundingHistoryApiSchema } from "@repo/types"
import { prisma } from "@repo/db"
import { Request, Response } from "express"

export async function getFundingHistory(req: Request, res: Response) {
  const userId = req.userId!;
  const parsed = getFundingHistoryApiSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Inputs" })
    return
  }
  const { limit, cursor } = parsed.data;

  try {
    const rows = await prisma.fundingSettlement.findMany({
      where: { userId },
      orderBy: { settledAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit;
    const settlements = hasMore ? rows.slice(0, limit) : rows;

    res.status(200).json({
      settlements,
      nextCursor: hasMore ? settlements[settlements.length - 1]!.id : null,
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
