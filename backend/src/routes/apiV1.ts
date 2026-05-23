import { authRoutes } from "@/app/http/controllers/auth/routes/authRoutes";
import { driveRoutes } from "@/app/http/controllers/drive/routes/driveRoutes";
import { notesRoutes } from "@/app/http/controllers/notes/routes/notesRoutes";
import { artifactRoutes } from "@/app/http/controllers/artifacts/routes/artifactRoutes";
import { chatRoutes } from "@/app/http/controllers/chat/routes/chatRoutes";
import { Router, Express } from "express";

export function apiV1(app: Express) {
  const router = Router();
  authRoutes(router);
  driveRoutes(router);
  notesRoutes(router);
  artifactRoutes(router);
  chatRoutes(router);
  app.use("/api/v1", router);
}
