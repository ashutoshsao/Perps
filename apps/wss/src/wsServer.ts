import WebSocket, { WebSocketServer } from "ws";
import { Env } from "./config";
import { verifyUserChannel } from "./helper/verifyUserChannel";
const wss = new WebSocketServer({ port: Env.PORT_WSS });

//store connected clients in each channel;
export const connectedSockets = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "SUBSCRIBE") {
        //subscribe to channel
        if (message.channel.startsWith("user")) {
          verifyUserChannel(message.channel, message.token);
        }
        //auth done now same add ws socket to map for that channel
        if (!connectedSockets.has(message.channel)) {
          connectedSockets.set(message.channel, new Set());
        }
        connectedSockets.get(message.channel)!.add(ws);

        //now this wss has to subscribe to redis pubsub this channel if haven't already
      }
      else {
        //unsubscribe from channel
        if (message.channel.startsWith("user")) {
          verifyUserChannel(message.channel, message.token);
        }
        if (!connectedSockets.has(message.channel)) return;
        connectedSockets.get(message.channel)?.delete(ws)
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: (err as Error).message }))
    }
  })

  ws.on("close", () => {
    // remove this ws from ALL channels it was subscribed to
    for (const [channel, sockets] of connectedSockets) {
      sockets.delete(ws)
      if (sockets.size === 0) connectedSockets.delete(channel)  // cleanup empty sets
    }
  })
})
