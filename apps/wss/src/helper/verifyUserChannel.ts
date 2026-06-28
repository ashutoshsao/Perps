import jwt from "jsonwebtoken";
import { Env } from "../config";
export function verifyUserChannel(channel: string, token: string): boolean {
  const { userId } = jwt.verify(token, Env.JWT_SECRET) as { userId: string }
  return channel === `user:${userId}:orders` ||
    channel === `user:${userId}:fills` ||
    channel === `user:${userId}:liquidations`
}
