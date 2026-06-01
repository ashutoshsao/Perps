import { AddBalanceApiSchema } from "@repo/types";
import type { Request, Response } from "express";
import { loopback } from "../service/loopBack";
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
