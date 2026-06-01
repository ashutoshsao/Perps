import { getBalancePayload } from "@repo/types";
import { fetchBalance } from "../helper/fetchBalance";

export function getBalance(payload: getBalancePayload) {
  const { userId } = payload;
  const usdBalance = fetchBalance(userId, "USD");
  return usdBalance;
}
