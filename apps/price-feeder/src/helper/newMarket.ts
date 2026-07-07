import { WebSocket } from "ws";

export const subscribedMarkets = new Set<string>();
const feedSymbolToMarketSymbol = new Map<string, string>();

let subscribeId = 1

function toBinanceSymbol(symbol: string) {
  const compact = symbol.replace(/[-_/]/g, "").toUpperCase();
  if (compact.endsWith("USDT")) return compact;
  if (compact.endsWith("USD")) return `${compact.slice(0, -3)}USDT`;
  return `${compact}USDT`;
}

export function getFeedSymbolForMarketSymbol(symbol: string) {
  return toBinanceSymbol(symbol);
}

export function newMarket(ws: WebSocket, symbol: string) {
  if (subscribedMarkets.has(symbol)) return;
  const feedSymbol = getFeedSymbolForMarketSymbol(symbol);
  feedSymbolToMarketSymbol.set(feedSymbol, symbol);

  ws.send(JSON.stringify({
    method: "SUBSCRIBE",
    params: [`${feedSymbol.toLowerCase()}@markPrice@1s`],
    id: subscribeId++
  }))
  subscribedMarkets.add(symbol);
}

export function getMarketSymbolForFeedSymbol(feedSymbol: string) {
  return feedSymbolToMarketSymbol.get(feedSymbol);
}
