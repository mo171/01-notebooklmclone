import { Router } from "express";
import { requireAuth } from "@/app/helpers/jwt";
import { createNote, uploadMiddleware } from "../repository/createNote";
import { getAllNotes } from "../getAllNotes";
import { getNoteById } from "../getNoteById";
import { updateNotes } from "../updateNotes";
import * as DocsController from "../docsController";
import { getDocOverview } from "../../chat/chatController";

export function notesRoutes(router: Router) {
  router.post("/notes", requireAuth, uploadMiddleware, createNote);
  router.get("/notes", requireAuth, getAllNotes);

  // Static paths must be registered before /notes/:noteId
  router.get("/notes/source/results", requireAuth, DocsController.getNoteDocs);
  router.get("/notes/search/web", requireAuth, DocsController.searchWeb);
  router.get("/notes/docs/overview", requireAuth, getDocOverview);

  router.post("/blank/notes", requireAuth, DocsController.createBlankNote);
  router.post("/notes/drive-files", requireAuth, DocsController.importDriveFile);
  router.post("/notes/weblinkdata", requireAuth, DocsController.importWebLink);
  router.post("/notes/text-data", requireAuth, DocsController.importTextData);
  router.post("/notes/youtube-link", requireAuth, DocsController.importYoutubeLink);

  router.put("/notes", requireAuth, updateNotes);
  router.patch("/notes/:noteId", requireAuth, updateNotes);

  router.get("/notes/:noteId", requireAuth, getNoteById);

  return router;
}
