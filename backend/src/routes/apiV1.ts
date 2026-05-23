import { driveRoutes } from "@/app/http/controllers/drive/routes/driveRoutes";
import { notesRoutes } from "@/app/http/controllers/notes/routes/notesRoutes";
import { artifactRoutes } from "@/app/http/controllers/artifacts/routes/artifactRoutes";
import { Router, Express } from "express";

export function apiV1(app: Express) {
  const router = Router();
  driveRoutes(router);
  notesRoutes(router);
  artifactRoutes(router);
  app.use("/api/v1", router);
}
