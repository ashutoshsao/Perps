import { prisma } from "@repo/db";
import { Request, Response } from "express";

export async function getUserFills(req: Request, res: Response) {
  const userId = req.userId!;
  try {
    const fills = await prisma.fill.findMany({
      where: {
        OR: [
          { takerUserId: userId },
          { makerUserId: userId }
        ]
      },
      orderBy: { createdAt: "desc" }
    })
    res.status(200).json({ fills })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
}
