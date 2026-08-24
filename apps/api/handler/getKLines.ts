import { timescale } from "@repo/db";
import { getKLinesApiSchema } from "@repo/types";
import { Request, Response } from "express";

const candleViews = {
  "1m": "candles_1m",
  "5m": "candles_5m",
  "15m": "candles_15m",
  "1h": "candles_1h",
  "4h": "candles_4h",
  "1d": "candles_1d",
} as const;

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
    const view = candleViews[interval]

    // view name comes from the fixed candleViews map above, never from user input
    const result = await timescale.query(
      `SELECT bucket, open, high, low, close, volume
       FROM ${view}
       WHERE symbol = $1
         AND bucket >= COALESCE(to_timestamp($2 / 1000.0), NOW() - INTERVAL '7 days')
         AND bucket <= COALESCE(to_timestamp($3 / 1000.0), NOW())
       ORDER BY bucket DESC
       LIMIT $4`,
      [symbol, from ?? null, to ?? null, limit]
    )

    res.status(200).json({ candles: result.rows.reverse() })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
