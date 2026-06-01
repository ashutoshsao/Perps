import type { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Env } from "../utils/config";

export const verifyAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization as string;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        message: "Invalid token"
      })
      return
    }

    const token = authHeader.slice(7);

    const decoded = jwt.verify(token, Env.JWT_SECRET) as JwtPayload;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(400).json({
      message: "Invalid token"
    })
  }
}
