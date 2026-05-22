import type { User as DbUser } from "@/app/bootstrap/models/userSchema";
import type { AuthSessionUser } from "./auth-session";

declare global {
  namespace Express {
    /** Passport session payload after Google OAuth */
    interface User extends AuthSessionUser {
      _id?: unknown;
    }
  }
}

declare module "express-serve-static-core" {
  interface Request {
    /** Set by JWT middleware on API routes */
    user?: InstanceType<typeof DbUser>;
  }
}

export {};
