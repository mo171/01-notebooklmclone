import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "@/app/bootstrap/models/userSchema";
import { Doc } from "@/app/bootstrap/models/docSchema";
import { NotesRepository } from "./repository/Notesrepository";

function inferSourceType(doc: InstanceType<typeof Doc>) {
  if (doc.mindMap) return "mindMap";
  if (doc.briefingDoc) {
    return doc.title?.toLowerCase().includes("audio")
      ? "audio"
      : "briefing-doc";
  }
  if (doc.summary) return "summary";
  if (doc.FAQ) return "faq";
  if (doc.studyGuide) return "studyguide";
  return "doc";
}

/**
 * GET /api/v1/notes/:noteId
 * Returns a single note belonging to the authenticated user.
 */
export async function getNoteById(
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

    const note = await NotesRepository.getInstance().findByIdForUser(
      new Types.ObjectId(noteId),
      user._id,
    );

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    const docs = await Doc.find({
      noteId: new Types.ObjectId(noteId),
      userId: user._id,
    }).sort({ createdAt: -1 });

    const formattedDocs = docs.map((doc) => ({
      _id: doc._id,
      title: doc.title,
      fileName: doc.title,
      noteId: doc.noteId,
      userId: doc.userId,
      source_type: inferSourceType(doc),
    }));

    const formatted = {
      _id: note._id,
      title: note.name,
      image: note.image ?? "",
      userId: note.userId,
      createdAt: note.createdAt,
      docs: formattedDocs,
    };

    return res.json({ note: formatted });
  } catch (err) {
    next(err);
  }
}
