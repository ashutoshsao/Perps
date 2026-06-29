import { timescale } from "@repo/db"
import { Request, Response } from "express"

export async function getTrades(req: Request, res: Response) {
  const symbol = req.params.symbol
  const limit = parseInt(req.query.limit as string) ?? 50

  try {
    const result = await timescale.query(
      `SELECT time, symbol, price, qty, side
       FROM fills_ts
       WHERE symbol = $1
       ORDER BY time DESC
       LIMIT $2`,
      [symbol, limit]
    )
    res.status(200).json({ trades: result.rows })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
