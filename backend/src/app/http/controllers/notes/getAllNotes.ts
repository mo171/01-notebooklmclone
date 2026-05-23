import { NextFunction, Request, Response } from "express";
import { User } from "@/app/bootstrap/models/userSchema";
import { Doc } from "@/app/bootstrap/models/docSchema";
import { NotesRepository } from "./repository/Notesrepository";

function formatNoteForClient(note: {
  _id: unknown;
  name: string;
  image?: string | null;
  userId: unknown;
  createdAt?: Date;
}) {
  return {
    _id: note._id,
    title: note.name,
    image: note.image ?? "",
    userId: note.userId,
    createdAt: note.createdAt,
    docs: [] as unknown[],
  };
}

export async function getAllNotes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const page = Number(req.query.page) || 1;
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const limit = Number(req.query.limit) || 12;

    const result = await NotesRepository.getInstance().findByUserPaginated(
      user._id,
      { page, search, limit },
    );

    const noteIds = result.notes.map((n) => n._id);
    const docCounts = await Doc.aggregate<{ _id: unknown; count: number }>([
      { $match: { noteId: { $in: noteIds } } },
      { $group: { _id: "$noteId", count: { $sum: 1 } } },
    ]);
    const countByNoteId = new Map(
      docCounts.map((d) => [String(d._id), d.count]),
    );

    const notes = result.notes.map((note) => {
      const formatted = formatNoteForClient(note);
      const count = countByNoteId.get(String(note._id)) ?? 0;
      formatted.docs = Array.from({ length: count }, (_, i) => ({
        _id: `placeholder-${i}`,
      }));
      return formatted;
    });

    return res.json({
      notes,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    next(err);
  }
}
