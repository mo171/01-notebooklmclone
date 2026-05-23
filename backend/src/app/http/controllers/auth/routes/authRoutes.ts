import { Router } from "express";
import { requireAuth } from "@/app/helpers/jwt";
import { getMe, logout } from "../authController";

export function authRoutes(router: Router) {
  router.get("/auth/me", requireAuth, getMe);
  router.get("/logout", logout);
  return router;
}
