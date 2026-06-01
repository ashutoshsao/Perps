import { addBalancePayload } from "@repo/types";
import { fetchBalance } from "../helper/fetchBalance";

export function addBalance(payload: addBalancePayload) {
  const { userId, amount } = payload;
  const usdBalances = fetchBalance(userId, "USD");
  usdBalances.available += amount;

  return usdBalances;
}
