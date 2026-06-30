export function normalizeMarketSymbol(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9]/g, "").replace(/USD$/i, "").toUpperCase();
}
