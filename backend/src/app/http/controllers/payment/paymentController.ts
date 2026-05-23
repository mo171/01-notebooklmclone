import { Request, Response, NextFunction } from "express";
import { User } from "@/app/bootstrap/models/userSchema";

/** Stub payment endpoints until Stripe integration is wired. */
export async function getUserCredits(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    console.log("[paymentController] getUserCredits", { userId: user._id });
    return res.json({
      result: { credits: 100, paymentType: null },
    });
  } catch (err) {
    next(err);
  }
}

export async function createSetupSession(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    console.log("[paymentController] createSetupSession — not implemented");
    return res.status(501).json({
      message: "Payment setup is not configured yet",
    });
  } catch (err) {
    next(err);
  }
}

export async function chargeCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    console.log("[paymentController] chargeCustomer — not implemented");
    return res.status(501).json({
      message: "Payments are not configured yet",
    });
  } catch (err) {
    next(err);
  }
}
