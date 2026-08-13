import { FUNDING_TIMES_UTC_HOURS, nextFundingTime, REDIS_KEYS } from "@repo/types"
import { prisma } from "@repo/db"
import { Request, Response } from "express"
import { redisGet } from "../service/redisClient"

export async function getFunding(req: Request, res: Response) {
  const symbol = req.params.symbol
  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ error: "symbol required" })
    return
  }

  try {
    const [predictedRaw, lastSettled] = await Promise.all([
      redisGet(REDIS_KEYS.predictedFunding(symbol)),
      prisma.fundingRate.findFirst({
        where: { symbol },
        orderBy: { settledAt: "desc" },
      }),
    ])

    const predicted = predictedRaw ? JSON.parse(predictedRaw) as { rate: number, samples: number, updatedAt: number } : null

    res.status(200).json({
      symbol,
      // fall back to last settled rate on cold start / dead engine (TTL lapsed)
      rate: predicted?.rate ?? lastSettled?.rate ?? 0,
      samples: predicted?.samples ?? 0,
      updatedAt: predicted?.updatedAt ?? null,
      lastSettled: lastSettled ? { rate: lastSettled.rate, settledAt: lastSettled.settledAt.getTime() } : null,
      nextSettlementAt: nextFundingTime(),
      intervalHours: 24 / FUNDING_TIMES_UTC_HOURS.length,
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
