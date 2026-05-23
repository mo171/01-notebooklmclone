import { Types } from "mongoose";
import {
  Note,
  type NoteSourceType,
  type NoteStatus,
} from "@/app/bootstrap/models/notesScchema";

export class NotesRepository {
  private static instance: NotesRepository;

  public static getInstance(): NotesRepository {
    if (!NotesRepository.instance) {
      NotesRepository.instance = new NotesRepository();
    }
    return NotesRepository.instance;
  }

  async createProcessingNote(params: {
    userId: Types.ObjectId;
    sourceType: NoteSourceType;
    sourceRef?: string;
  }) {
    return Note.create({
      name: "Processing...",
      status: "processing" as NoteStatus,
      sourceType: params.sourceType,
      sourceRef: params.sourceRef,
      userId: params.userId,
    });
  }

  async findByUser(userId: Types.ObjectId) {
    return Note.find({ userId }).sort({ createdAt: -1 });
  }

  async findByUserPaginated(
    userId: Types.ObjectId,
    options: { page?: number; search?: string; limit?: number },
  ) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 12));
    const search = options.search?.trim() ?? "";

    const filter: Record<string, unknown> = { userId };
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const [notes, total] = await Promise.all([
      Note.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Note.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { notes, total, totalPages, page, limit };
  }

  async findByIdForUser(noteId: Types.ObjectId, userId: Types.ObjectId) {
    return Note.findOne({ _id: noteId, userId });
  }

  async markReady(
    noteId: Types.ObjectId,
    data: { name: string; image: string; description?: string },
  ) {
    return Note.findByIdAndUpdate(
      noteId,
      {
        name: data.name,
        image: data.image,
        description: data.description,
        status: "ready",
        error: undefined,
      },
      { new: true },
    );
  }

  async markFailed(noteId: Types.ObjectId, error: string) {
    return Note.findByIdAndUpdate(
      noteId,
      { status: "failed", error },
      { new: true },
    );
  }
}
