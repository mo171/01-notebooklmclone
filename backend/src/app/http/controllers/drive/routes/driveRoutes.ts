import { Router } from "express";
import { requireAuth } from "@/app/helpers/jwt";
import { getUserDriveFiles } from "../getUserDriveFiles";

export function driveRoutes(router: Router) {
  router.get("/users/files", requireAuth, getUserDriveFiles);
  return router;
}
