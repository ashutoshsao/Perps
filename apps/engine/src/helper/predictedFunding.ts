import { FUNDING_RATE_ACCOUMILATOR, LAST_FUNDING } from "../engine-store";

export function currentFundingRate(symbol: string): { rate: number, samples: number } {
  const acc = FUNDING_RATE_ACCOUMILATOR.get(symbol);
  const samples = acc?.samples ?? 0;
  let rate = samples > 0 ? acc!.sumPremium / samples : (LAST_FUNDING.get(symbol) ?? 0);
  rate = Math.max(-0.0075, Math.min(0.0075, rate));
  return { rate, samples };
}
