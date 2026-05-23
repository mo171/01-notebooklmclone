import { Router } from "express";
import { requireAuth } from "@/app/helpers/jwt";
import { ArtifactsController } from "../artifactsController";

export function artifactRoutes(router: Router) {
  router.post("/notes/:noteId/summary", requireAuth, ArtifactsController.generateSummary);
  router.post("/notes/:noteId/briefing-doc", requireAuth, ArtifactsController.generateBriefingDoc);
  router.post("/notes/:noteId/faq", requireAuth, ArtifactsController.generateFaq);
  router.post("/notes/:noteId/mind-map", requireAuth, ArtifactsController.generateMindMap);
  router.post("/notes/:noteId/study-guide", requireAuth, ArtifactsController.generateStudyGuide);

  return router;
}
