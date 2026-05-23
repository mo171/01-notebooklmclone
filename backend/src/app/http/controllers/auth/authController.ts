import { NextFunction, Request, Response } from "express";
import { User } from "@/app/bootstrap/models/userSchema";
import { generateTokens } from "@/app/helpers/jwt";

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = await generateTokens(user._id);

    return res.json({
      authData: {
        ...user.toObject(),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

export function logout(req: Request, res: Response, next: NextFunction) {
  const finish = () => {
    if (req.session) {
      req.session.destroy(() => {
        res.json({ message: "Logged out successfully" });
      });
      return;
    }
    res.json({ message: "Logged out successfully" });
  };

  if (typeof req.logout === "function") {
    req.logout((err) => {
      if (err) return next(err);
      finish();
    });
    return;
  }

  finish();
}
