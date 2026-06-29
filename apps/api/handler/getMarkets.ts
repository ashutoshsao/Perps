import { prisma } from "@repo/db";
import { Request, Response } from "express";

export async function getMarkets(req: Request, res: Response) {
  try {
    const markets = await prisma.market.findMany();
    res.status(200).json({
      markets
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
