import { Pool } from "pg"

export const timescale = new Pool({
  connectionString: process.env.DATABASE_URL
})

export async function insertFill(
  symbol: string,
  price: number,
  qty: number,
  side: string,
  createdAt: number
) {
  await timescale.query(
    `INSERT INTO fills_ts (time, symbol, price, qty, side)
     VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5)`,
    [createdAt, symbol, price, qty, side]
  )
}
