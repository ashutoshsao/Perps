import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Env } from "../utils/config";
import { SigninApiSchema, SignupApiSchema } from "@repo/types";

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

  const token = jwt.sign({
    userId: user.id
  }, Env.JWT_SECRET);

  res.status(201).json({
    token
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

  const token = jwt.sign({
    userId: existingUser.id
  }, Env.JWT_SECRET);

  res.status(200).json({
    token
  })
}
