import { Pool } from "pg"

export const timescale = new Pool({
  connectionString: process.env.DATABASE_URL
})

export async function insertFill(
  fillId: string,
  symbol: string,
  price: number,
  qty: number,
  side: string,
  createdAt: number
) {
  await timescale.query(
    `INSERT INTO fills_ts (fill_id, time, symbol, price, qty, side)
     VALUES ($1, to_timestamp($2 / 1000.0), $3, $4, $5, $6)
     ON CONFLICT (fill_id, time) DO NOTHING`,
    [fillId, createdAt, symbol, price, qty, side]
  )
}
