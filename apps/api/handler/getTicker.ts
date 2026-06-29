import { timescale } from "@repo/db"
import { Request, Response } from "express"

export async function getTicker(req: Request, res: Response) {
  const symbol = req.params.symbol
  if (!symbol) {
    res.status(400).json({ error: "symbol required" })
    return
  }

  try {
    const result = await timescale.query(
      `SELECT
        first(open,   bucket) AS open,
        max(high)             AS high,
        min(low)              AS low,
        last(close,   bucket) AS close,
        sum(volume)           AS volume
       FROM candles_1h
       WHERE symbol = $1
         AND bucket >= NOW() - INTERVAL '24 hours'`,
      [symbol]
    )

    const row = result.rows[0]
    if (!row || !row.close) {
      res.status(404).json({ error: "no data for symbol" })
      return
    }

    const change = row.close - row.open
    const changePct = ((change / row.open) * 100).toFixed(2)

    res.status(200).json({
      symbol,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      change,
      changePct,
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
