import { addBalanceType } from "@repo/types";
import { BALANCES } from "../engine-store";

export function onramp(payload: addBalanceType) {
  const { userId, amount } = payload;
  const balances = BALANCES.get(userId);
}
