import { getRedisClient } from "@repo/redis";

const clientPromise = getRedisClient();

export async function redisGet(key: string) {
  const client = await clientPromise;
  return client.get(key);
}
