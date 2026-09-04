import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@repo/db";
import { Env } from "../utils/config";

export class RefreshTokenError extends Error { }

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function createAccessToken(userId: string): string {
  return jwt.sign({ userId }, Env.JWT_SECRET, { expiresIn: Env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"] });
}

export async function createRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + Env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    }
  });
  return raw;
}

// re-checks the account against the DB on every refresh — this is what closes the
// gap a stateless access token can't: a token whose account was later deleted stops
// working the moment its access token expires, instead of working forever
export async function rotateAccessToken(rawRefreshToken: string): Promise<string> {
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawRefreshToken) } });
  if (!record) throw new RefreshTokenError("Invalid refresh token");
  if (record.revokedAt) throw new RefreshTokenError("Refresh token revoked");
  if (record.expiresAt < new Date()) throw new RefreshTokenError("Refresh token expired");

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new RefreshTokenError("User no longer exists");

  return createAccessToken(user.id);
}

export async function revokeRefreshToken(rawRefreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawRefreshToken) },
    data: { revokedAt: new Date() }
  });
}
