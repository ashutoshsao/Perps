import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { Env } from "./config";
export const getRedisClient = async () => {
  const redis = createClient({ url: Env.REDIS_URL })
  await redis.connect();
  return redis;
}
