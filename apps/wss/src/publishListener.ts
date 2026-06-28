import { getRedisClient } from "@repo/redis";
import { connectedSockets } from "./wsServer";


const subscribedChannels = new Set<string>()

export async function subscribeToChannel(channel: string) {
  const redisSubClient = await getRedisClient();
  if (subscribedChannels.has(channel)) return  // already subscribed — skip

  redisSubClient.subscribe(channel, (message) => {
    const sockets = connectedSockets.get(channel);
    if (!sockets) return;

    for (const ws of sockets) {
      try {
        ws.send(JSON.stringify({ channel, data: JSON.parse(message) }))
      } catch {
        sockets.delete(ws)  // remove dead connection
      }
    }
  })


  subscribedChannels.add(channel)
}


