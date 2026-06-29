import { getDepthApiSchema } from "@repo/types";
import { Request, Response } from "express";
import { loopback } from "../service/loopBack";

export async function getDepth(req: Request, res: Response) {
  const parsed = getDepthApiSchema.safeParse(req.params.symbol);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid Inputs"
    })
    return;
  }
  const symbol = parsed.data;
  try {
    const response = await loopback("get_depth", { symbol });
    res.status(200).json(response)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}
