import { AddBalanceApiSchema, CancelOrderApiSchema, CreateMarketApiSchema, CreateOrderApiSchema } from "@repo/types";
import { type Request, type Response } from "express";
import { loopback } from "../service/loopBack";
import { prisma } from "@repo/db";
import { Env } from "../utils/config";

export const addBalance = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const parsed = AddBalanceApiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input" })
    return;
  }
  const { amount } = parsed.data;
  try {
    const response = await loopback("add_balance", {
      userId,
      amount
    })
    res.status(200).json({ response })

  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export const createMarket = async (req: Request, res: Response) => {

  try {
    const adminEnv = req.headers.token;
    if (adminEnv !== Env.ADMIN_SECRET) {
      res.status(401).json({
        message: "Invalid inputs"
      })
      return
    }

    const parsed = CreateMarketApiSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input" })
      return;
    }

    const { maxLeverage, minQty, symbol, imageUrl } = parsed.data;
    const existingMarket = await prisma.market.findUnique({
      where: { symbol }
    })
    if (existingMarket) {
      res.status(409).json({
        message: "market already present"
      })
      return
    }

    const market = await prisma.market.create({
      data: {
        maxLeverage,
        minQty,
        symbol,
        imageUrl
      }
    });

    await loopback("create_market", {
      maxLeverage,
      minQty,
      symbol
    });

    res.status(201).json({
      marketId: market.id
    });

  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "server error"
    })
  }
}

export const createOrder = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const parsed = CreateOrderApiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input" })
    return;
  };

  try {
    const response = await loopback("create_order", { userId, ...parsed.data })
    res.status(200).json(response)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export const cancelOrder = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const parsed = CancelOrderApiSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input" })
    return;
  };
  const orderId = parsed.data;
  try {
    const response = await loopback("create_order", { userId, orderId })
    res.status(200).json(response)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}
