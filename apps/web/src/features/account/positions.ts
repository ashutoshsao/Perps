import type { UserFill } from "../../api/types";

export type DerivedPosition = {
  symbol: string;
  side: "long" | "short";
  qty: number;
  averagePrice: number;
};

export function derivePositions(fills: UserFill[]) {
  const bySymbol = new Map<string, { signedQty: number; averagePrice: number }>();

  for (const fill of [...fills].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    if (fill.makerUserId === fill.takerUserId) continue;

    const qty = fill.side === "buy" ? fill.qty : -fill.qty;
    const existing = bySymbol.get(fill.symbol);

    if (!existing || existing.signedQty === 0 || Math.sign(existing.signedQty) === Math.sign(qty)) {
      const currentQty = existing?.signedQty ?? 0;
      const nextQty = currentQty + qty;
      const weightedNotional = Math.abs(currentQty) * (existing?.averagePrice ?? 0) + Math.abs(qty) * fill.price;
      bySymbol.set(fill.symbol, {
        signedQty: nextQty,
        averagePrice: weightedNotional / Math.abs(nextQty),
      });
      continue;
    }

    const nextQty = existing.signedQty + qty;
    if (nextQty === 0) {
      bySymbol.delete(fill.symbol);
    } else if (Math.sign(nextQty) === Math.sign(existing.signedQty)) {
      bySymbol.set(fill.symbol, { ...existing, signedQty: nextQty });
    } else {
      bySymbol.set(fill.symbol, { signedQty: nextQty, averagePrice: fill.price });
    }
  }

  return Array.from(bySymbol.entries()).map(([symbol, position]): DerivedPosition => ({
    symbol,
    side: position.signedQty > 0 ? "long" : "short",
    qty: Math.abs(position.signedQty),
    averagePrice: position.averagePrice,
  }));
}
