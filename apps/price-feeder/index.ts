import WebSocket from "ws"

const ws = new WebSocket("wss://fstream.binance.com/market/stream?streams=btcusdt@markPrice")

ws.on("open", () => {
  console.log("connected")
  // no subscribe message needed with stream URL — data flows immediately
})

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString())
  console.log(msg.data.i);
})
