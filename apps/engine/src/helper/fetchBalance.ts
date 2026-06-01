import { BALANCES } from "../engine-store";

export function fetchBalance(userId: string, symbol: string) {
  let balances = BALANCES.get(userId);
  if (!balances) {
    balances = new Map();
    BALANCES.set(userId, balances);
  }
  let symbolBalance = balances.get(symbol);
  if (!symbolBalance) {
    symbolBalance = { available: 0, locked: 0 }
    balances.set(symbol, symbolBalance);
  }
  return symbolBalance;
}
