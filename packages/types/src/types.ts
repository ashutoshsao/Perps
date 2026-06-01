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
    marketId: z.uuid(),
  }),
  z.object({
    orderType: z.literal("market"),
    side,
    qty: int,
    leverage: int.min(1),
    slippageBps: int.min(0),
    marketId: z.uuid(),
  }),
])


export const CreateMarketApiSchema = z.object({
  symbol: z.string().min(1),
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

export type SignupApiType = z.infer<typeof SignupApiSchema>
export type SigninApiType = z.infer<typeof SigninApiSchema>
export type CreateOrderApiType = z.infer<typeof CreateOrderApiSchema>
export type CreateMarketApiType = z.infer<typeof CreateMarketApiSchema>
export type AddBalanceApiType = z.infer<typeof AddBalanceApiSchema>
export type OrderParams = z.infer<typeof OrderParamsSchema>
export type DepthParams = z.infer<typeof DepthParamsSchema>
