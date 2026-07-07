import { timescale } from "@repo/db";
import { getKLinesApiSchema } from "@repo/types";
import { Request, Response } from "express";

const intervalBuckets = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "1h": "1 hour",
  "4h": "4 hours",
  "1d": "1 day",
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
    const bucket = intervalBuckets[interval]

    const result = await timescale.query(
      `WITH bucketed AS (
         SELECT
           time_bucket($2::interval, time) AS bucket,
           time,
           price,
           qty
         FROM fills_ts
         WHERE symbol = $1
           AND time >= COALESCE(to_timestamp($3 / 1000.0), NOW() - INTERVAL '7 days')
           AND time <= COALESCE(to_timestamp($4 / 1000.0), NOW())
       )
       SELECT
         bucket,
         first(price, time) AS open,
         max(price) AS high,
         min(price) AS low,
         last(price, time) AS close,
         sum(qty) AS volume
       FROM bucketed
       GROUP BY bucket
       ORDER BY bucket DESC
       LIMIT $5`,
      [symbol, bucket, from ?? null, to ?? null, limit]
    )

    res.status(200).json({ candles: result.rows.reverse() })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
