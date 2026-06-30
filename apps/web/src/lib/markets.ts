import type { Market, Ticker } from "../api/types";
import { primaryMarketOrder } from "../app/constants";
import { formatNumber } from "./format";

export function sortMarkets(markets: Market[]) {
  return [...markets].sort((a, b) => {
    const aIndex = primaryMarketOrder.indexOf(a.symbol);
    const bIndex = primaryMarketOrder.indexOf(b.symbol);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    }
    const aIsTest = a.symbol.startsWith("TEST-");
    const bIsTest = b.symbol.startsWith("TEST-");
    if (aIsTest !== bIsTest) return aIsTest ? 1 : -1;
    return a.symbol.localeCompare(b.symbol);
  });
}

export function getMarketSymbol(marketId: string, markets: Market[]) {
  return markets.find((market) => market.id === marketId)?.symbol ?? marketId;
}

export function splitMarketSymbol(symbol: string) {
  const [base = symbol, quote = "USD"] = symbol.split("-");
  return { base, quote };
}

export function formatPerpSymbol(symbol: string) {
  const { base } = splitMarketSymbol(symbol);
  return base;
}

export function formatPairSymbol(_symbol: string) {
  return "PERPETUAL";
}

export function getMarketSearchAliases(symbol: string) {
  const { base, quote } = splitMarketSymbol(symbol);
  return [
    base,
    `${base}-perp`,
    `${base}/${quote}`.toLowerCase(),
    "perpetual",
  ];
}

export function formatMarkPrice(markPrice: number | undefined, _ticker: Ticker | null, _fallback: string) {
  if (typeof markPrice === "number") return formatNumber(markPrice / 1_000_000);
  return "-";
}

export function formatLastPrice(ticker: Ticker | null) {
  if (!ticker) return "-";
  return formatNumber(ticker.close);
}

export function getReferencePrice(markPrice: number | undefined, ticker: Ticker | null) {
  if (typeof markPrice === "number" && Number.isFinite(markPrice)) return markPrice / 1_000_000;
  const close = Number(ticker?.close);
  return Number.isFinite(close) && close > 0 ? close : null;
}

export function formatTickerChange(ticker: Ticker | null) {
  if (!ticker) return "-";
  const pct = Number(ticker.changePct);
  if (!Number.isFinite(pct)) return `${ticker.changePct}%`;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

export function getTickerTone(ticker: Ticker | null): "positive" | "negative" | "neutral" {
  const pct = Number(ticker?.changePct);
  if (!Number.isFinite(pct)) return "neutral";
  return pct >= 0 ? "positive" : "negative";
}

export function formatTickerVolume(ticker: Ticker | null) {
  if (!ticker) return "-";
  return formatNumber(ticker.volume);
}
