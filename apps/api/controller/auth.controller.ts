import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import argon2 from "argon2";
import { SigninApiSchema, SignupApiSchema } from "@repo/types";
import { createAccessToken, createRefreshToken, RefreshTokenError, revokeRefreshToken, rotateAccessToken } from "../helper/token";

export const signup = async (req: Request, res: Response) => {
  const parsed = SignupApiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid credentials"
    })
    return
  }

  const { name, username, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: {
      username
    }
  })

  if (existingUser) {
    res.status(409).json({
      message: "User already present"
    })
    return
  }

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      username,
      name,
      password: passwordHash
    }
  })

  const token = createAccessToken(user.id);
  const refreshToken = await createRefreshToken(user.id);

  res.status(201).json({
    token,
    refreshToken
  });
}

export const signin = async (req: Request, res: Response) => {
  const parsed = SigninApiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid credentials"
    })
    return
  };

  const { username, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: {
      username
    }
  });

  if (!existingUser) {
    res.status(401).json({
      message: "No user in db"
    })
    return
  }

  const verify = await argon2.verify(existingUser.password, password);

  if (!verify) {
    res.status(401).json({
      message: "Invalid credentials"
    })
    return
  }

  const token = createAccessToken(existingUser.id);
  const refreshToken = await createRefreshToken(existingUser.id);

  res.status(200).json({
    token,
    refreshToken
  })
}

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ message: "Invalid refresh token" })
    return
  }

  try {
    const token = await rotateAccessToken(refreshToken);
    res.status(200).json({ token })
  } catch (error) {
    if (error instanceof RefreshTokenError) {
      res.status(401).json({ message: error.message })
      return
    }
    throw error
  }
}

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken && typeof refreshToken === "string") {
    await revokeRefreshToken(refreshToken);
  }
  res.status(200).json({ message: "Logged out" })
}
