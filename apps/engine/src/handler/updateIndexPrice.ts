import { updateIndexPricePayload } from "@repo/types";
import { INDEX_PRICES } from "../engine-store";
import { liquidationCheck } from "../helper/liquidationCheck";

export function updateIndexPrice(payload: updateIndexPricePayload) {
  const { symbol, price } = payload;
  INDEX_PRICES.set(symbol, price);
  liquidationCheck(symbol, price);
}
