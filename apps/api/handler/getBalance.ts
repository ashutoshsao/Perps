import { Request, Response } from "express";
import { loopback } from "../service/loopBack";

export async function getBalance(req: Request, res: Response) {
  const userId = req.userId!;
  try {
    const resposne = await loopback("get_balance", {
      userId
    });
    res.status(200).json({ resposne })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
