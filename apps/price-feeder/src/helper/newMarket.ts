import { WebSocket } from "ws";

export const subscribedMarkets = new Set<string>();

let subscribeId = 1
export function newMarket(ws: WebSocket, symbol: string) {
  if (subscribedMarkets.has(symbol)) return;
  ws.send(JSON.stringify({
    method: "SUBSCRIBE",
    params: [`${symbol.toLowerCase()}usdt@markPrice@1s`],
    id: subscribeId++
  }))
  subscribedMarkets.add(symbol);
}
