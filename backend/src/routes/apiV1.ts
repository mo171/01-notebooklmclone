import { driveRoutes } from "@/app/http/controllers/drive/routes/driveRoutes";
import { Router, Express } from "express";

export function apiV1(app: Express) {
  const router = Router();
  driveRoutes(router);
  app.use("/api/v1", router);
}
