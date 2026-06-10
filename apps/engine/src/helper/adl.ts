import { Position } from "@repo/types";
import { INDEX_PRICES, POSITIONS } from "../engine-store";
import { createOrder } from "../handler/createOrder";

export function adl(position: Position) {
  const oppositeSide = position.positionSide === "long" ? "short" : "long";
  const markPrice = INDEX_PRICES.get(position.symbol)!;
  const candidates: { userId: string, pos: Position, pnl: number }[] = []

  for (const [userId, userPosition] of POSITIONS) {
    const pos = userPosition.get(position.symbol);
    if (!pos) continue;
    if (pos.positionSide !== oppositeSide) continue;
    const pnl = pos.positionSide === "short"
      ? Math.floor(Number((BigInt(pos.averagePrice) - BigInt(markPrice)) * BigInt(pos.qty)))
      : Math.floor(Number((BigInt(markPrice) - BigInt(pos.averagePrice)) * BigInt(pos.qty)))
    if (pnl < 0) continue;
    candidates.push({
      userId,
      pos,
      pnl
    })
  }

  candidates.sort((a, b) => b.pnl - a.pnl);

  let remainingQty = position.qty;

  for (const candidate of candidates) {
    if (remainingQty <= 0) break;
    const fillQty = Math.min(candidate.pos.qty, remainingQty);
    remainingQty -= fillQty;
    createOrder({
      userId: candidate.pos.userId,
      symbol: position.symbol,
      side: candidate.pos.positionSide === "long" ? "sell" : "buy",
      orderType: "market",
      qty: fillQty,
      leverage: Math.floor((candidate.pos.averagePrice * candidate.pos.qty) / candidate.pos.margin),
      slippageBps: 10000
    });

  }
  if (remainingQty > 0) {
    console.error(`ADL failed for ${position.symbol} — remaining qty: ${remainingQty}`)
    // V2: socialize loss across all positions
  }
}
