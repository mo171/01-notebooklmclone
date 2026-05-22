import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "@/app/bootstrap/models/userSchema";
import { Note } from "@/app/bootstrap/models/notesScchema";
import { NotesRepository } from "./repository/Notesrepository";

/**
 * PATCH /api/v1/notes/:noteId
 * Allows the authenticated user to update the `name` of one of their notes.
 */
export async function updateNotes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const noteIdParam = req.params.noteId;
    const noteId = Array.isArray(noteIdParam) ? noteIdParam[0] : noteIdParam;

    if (!noteId || !Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    // Verify ownership before updating
    const existing = await NotesRepository.getInstance().findByIdForUser(
      new Types.ObjectId(noteId),
      user._id,
    );

    if (!existing) {
      return res.status(404).json({ message: "Note not found" });
    }

    const { name } = req.body as { name?: unknown };

    if (typeof name !== "string" || !name.trim()) {
      return res
        .status(400)
        .json({ message: "A non-empty 'name' string is required" });
    }

    const updated = await Note.findByIdAndUpdate(
      noteId,
      { name: name.trim() },
      { new: true },
    );

    return res.json({ note: updated });
  } catch (err) {
    next(err);
  }
}
