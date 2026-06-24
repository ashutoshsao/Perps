import { MARKETS } from "../engine-store";

export function getMarkets() {
  return Array.from(MARKETS.keys());
}
