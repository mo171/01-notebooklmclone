import { NextFunction, Response, Request } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { User } from "@/app/bootstrap/models/userSchema";

function accessJwtPayload(userId: Types.ObjectId) {
  return {
    iss: null,
    sub: userId,
    aud: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    iat: Math.floor(Date.now() / 1000),
  };
}

function refreshJwtPayload(userId: Types.ObjectId) {
  return {
    iss: null,
    sub: userId,
    aud: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    iat: Math.floor(Date.now() / 1000),
  };
}

export function signAccessToken(userId: Types.ObjectId) {
  const payload = accessJwtPayload(userId);
  const key = process.env.JWT_TOKEN_KEY as string;

  return new Promise<string>((resolve, reject) => {
    jwt.sign(payload, key, (error, token) => {
      if (error || !token) {
        reject(error ?? new Error("Failed to sign access token"));
        return;
      }
      resolve(token);
    });
  });
}

export function signRefreshToken(userId: Types.ObjectId) {
  const payload = refreshJwtPayload(userId);
  const key = process.env.REFRESH_TOKEN_KEY as string;

  return new Promise<string>((resolve, reject) => {
    jwt.sign(payload, key, (error, token) => {
      if (error || !token) {
        reject(error ?? new Error("Failed to sign refresh token"));
        return;
      }
      resolve(token);
    });
  });
}

export async function generateTokens(userId: Types.ObjectId) {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId),
    signRefreshToken(userId),
  ]);

  return { accessToken, refreshToken };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const accessToken = authHeader.split(" ")[1];
    const key = process.env.JWT_TOKEN_KEY as string;

    const decoded = jwt.verify(accessToken, key) as { sub: string };
    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

/** @deprecated Use requireAuth — kept for existing imports */
export const VerifyExpressToken = requireAuth;
