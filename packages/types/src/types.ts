import { z } from "zod"

const int = z.number().int()
const side = z.enum(["buy", "sell"])

export const SignupApiSchema = z.object({
  name: z.string().optional(),
  username: z.string().min(1),
  password: z.string().min(1)
})

export const SigninApiSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const CreateOrderApiSchema = z.discriminatedUnion("orderType", [
  z.object({
    orderType: z.literal("limit"),
    side,
    price: int,
    qty: int,
    leverage: int.min(1),
    symbol: z.string().min(1),
  }),
  z.object({
    orderType: z.literal("market"),
    side,
    qty: int,
    leverage: int.min(1),
    slippageBps: int.min(0).max(10000),
    symbol: z.string().min(1),
  }),
])

export const CancelOrderApiSchema = z.string();

export const CreateMarketApiSchema = z.object({
  // canonical form is decided here, once — everything downstream (Postgres, the
  // engine's MARKETS/ORDERBOOKS keys, every market:{symbol}:* channel) uses it verbatim
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/),
  imageUrl: z.string(),
  maxLeverage: int.min(1),
  minQty: int.min(1),
})

export const AddBalanceApiSchema = z.object({
  amount: int.min(1),
})

export const OrderParamsSchema = z.object({
  orderId: z.uuid(),
})

export const DepthParamsSchema = z.object({
  symbol: z.string().min(1),
})

export const getDepthApiSchema = z.string()

export const getKLinesApiSchema = z.object({
  symbol: z.string().min(1),
  interval: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]).default("1m"),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
})

export const getFundingHistoryApiSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

export const getPositionHistoryApiSchema = z.object({
  symbol: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

export type SignupApiType = z.infer<typeof SignupApiSchema>
export type SigninApiType = z.infer<typeof SigninApiSchema>
export type CreateOrderApiType = z.infer<typeof CreateOrderApiSchema>
export type CreateMarketApiType = z.infer<typeof CreateMarketApiSchema>
export type AddBalanceApiType = z.infer<typeof AddBalanceApiSchema>
export type OrderParams = z.infer<typeof OrderParamsSchema>
export type DepthParams = z.infer<typeof DepthParamsSchema>
export type GetFundingHistoryApiType = z.infer<typeof getFundingHistoryApiSchema>
export type GetPositionHistoryApiType = z.infer<typeof getPositionHistoryApiSchema>
