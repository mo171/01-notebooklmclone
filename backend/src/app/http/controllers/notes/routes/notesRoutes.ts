import { Router } from "express";
import { requireAuth } from "@/app/helpers/jwt";
import { createNote, uploadMiddleware } from "../repository/createNote";
import { getAllNotes } from "../getAllNotes";
import { getNoteById } from "../getNoteById";
import { updateNotes } from "../updateNotes";

export function notesRoutes(router: Router) {
  /** POST /api/v1/notes — create note from drive/url/file upload */
  router.post("/notes", requireAuth, uploadMiddleware, createNote);

  /** GET /api/v1/notes — get all notes for the current user */
  router.get("/notes", requireAuth, getAllNotes);

  /** GET /api/v1/notes/:noteId — get a single note */
  router.get("/notes/:noteId", requireAuth, getNoteById);

  /** PATCH /api/v1/notes/:noteId — rename a note */
  router.patch("/notes/:noteId", requireAuth, updateNotes);

  return router;
}
