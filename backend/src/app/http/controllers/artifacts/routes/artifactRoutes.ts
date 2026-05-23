import { Router } from "express";
import { requireAuth } from "@/app/helpers/jwt";
import * as ArtifactsController from "../artifactsController";

export function artifactRoutes(router: Router) {
  // ── Step 1: Check Ready Endpoints ──
  router.post("/notes/summary", requireAuth, ArtifactsController.checkSummaryReady);
  router.post("/notes/faq", requireAuth, ArtifactsController.checkFaqReady);
  router.post("/notes/studyguide", requireAuth, ArtifactsController.checkStudyGuideReady);
  router.post("/notes/briefingdoc", requireAuth, ArtifactsController.checkBriefingDocReady);
  router.post("/notes/mindmap", requireAuth, ArtifactsController.checkMindMapReady);

  // ── Step 2: Generate & Save Endpoints ──
  router.post("/notes/add/sources", requireAuth, ArtifactsController.saveSummaryToSources);
  router.post("/notes/add/faq/sources", requireAuth, ArtifactsController.saveFaqToSources);
  router.post("/notes/add/studyguide/sources", requireAuth, ArtifactsController.saveStudyGuideToSources);
  router.post("/notes/add/briefingdoc/sources", requireAuth, ArtifactsController.saveBriefingDocToSources);
  router.post("/notes/add/mindmap/sources", requireAuth, ArtifactsController.saveMindMapToSources);

  return router;
}
