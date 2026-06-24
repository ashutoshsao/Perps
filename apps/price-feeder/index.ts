import WebSocket from "ws"

const ws = new WebSocket("wss://fstream.binance.com/market/ws");

ws.on("open", () => {
  ws.send(JSON.stringify({
    method: "SUBSCRIBE",
    params: ["btcusdt@markPrice@1s"],
    id: 1
  }))
})

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString())
  if (!msg.e) return  // subscription confirmation has no "e" field
  console.log({ symbol: msg.s, indexPrice: msg.i, markPrice: msg.p })
})

ws.on("ping", (data) => ws.pong(data))
