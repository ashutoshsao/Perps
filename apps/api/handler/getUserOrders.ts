import { prisma } from "@repo/db";
import { Request, Response } from "express";

export async function getUserOrders(req: Request, res: Response) {
  const userId = req.userId!;
  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    })
    res.status(200).json({ orders })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
