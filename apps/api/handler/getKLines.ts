import { timescale } from "@repo/db";
import { getKLinesApiSchema } from "@repo/types";
import { Request, Response } from "express";

export async function getKLines(req: Request, res: Response) {
  const parsed = getKLinesApiSchema.safeParse({
    symbol: req.params.symbol,
    ...req.query
  })
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid inputs" })
    return
  }
  try {
    const { symbol, interval, from, to, limit } = parsed.data

    const view = `candles_${interval}`

    const result = await timescale.query(
      `SELECT bucket, open, high, low, close, volume
       FROM ${view}
       WHERE symbol = $1
         AND bucket >= COALESCE(to_timestamp($2 / 1000.0), NOW() - INTERVAL '7 days')
         AND bucket <= COALESCE(to_timestamp($3 / 1000.0), NOW())
       ORDER BY bucket ASC
       LIMIT $4`,
      [symbol, from ?? null, to ?? null, limit]
    )

    res.status(200).json({ candles: result.rows })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
