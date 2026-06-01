import { getBalanceType } from "@repo/types";
import { getBalance } from "../helper/getBalance";

export function fetchBalance(payload: getBalanceType) {
  const { userId } = payload;
  const usdBalance = getBalance(userId, "USD");
  return usdBalance;
}
