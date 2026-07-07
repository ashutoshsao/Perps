import { getRedisClient } from "@repo/redis";
import { connectedSockets } from "./channelRegistry";

const subscribedChannels = new Map<string, Promise<void>>()
const redisSubClientPromise = getRedisClient()

export async function subscribeToChannel(channel: string) {
  const existingSubscription = subscribedChannels.get(channel)
  if (existingSubscription) return existingSubscription

  const subscription = redisSubClientPromise.then(async (redisSubClient) => {
    await redisSubClient.subscribe(channel, (message) => {
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
  })

  subscribedChannels.set(channel, subscription)
  return subscription
}
