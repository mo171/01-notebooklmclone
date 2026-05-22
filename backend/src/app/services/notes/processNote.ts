import fs from "fs/promises";
import { Types } from "mongoose";
import { User } from "@/app/bootstrap/models/userSchema";
import { NotesRepository } from "@/app/http/controllers/notes/repository/Notesrepository";
import { loadNoteSource, type NoteSourceInput } from "./loader";
import { generateTitle } from "./Titlegeneration";
import { generateImagePrompt } from "./generatePrompt";
import { generateImage } from "./generateImage";

export type ProcessNoteJobData = {
  noteId: string;
  userId: string;
  source: {
    type: "drive" | "url" | "upload";
    driveFileId?: string;
    url?: string;
    uploadPath?: string;
    originalName?: string;
  };
};

export async function processNoteJob(data: ProcessNoteJobData): Promise<void> {
  const { noteId, userId, source } = data;
  let uploadPath = source.uploadPath;

  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    let sourceInput: NoteSourceInput;

    if (source.type === "url" && source.url) {
      sourceInput = { type: "url", url: source.url };
    } else if (source.type === "drive" && source.driveFileId) {
      sourceInput = {
        type: "drive",
        driveFileId: source.driveFileId,
        user,
      };
    } else if (source.type === "upload" && source.uploadPath) {
      sourceInput = {
        type: "upload",
        uploadPath: source.uploadPath,
        originalName: source.originalName,
      };
    } else {
      throw new Error("Invalid note source payload");
    }

    const { fullText, excerpt } = await loadNoteSource(sourceInput);
    const title = await generateTitle(fullText);
    const imagePrompt = await generateImagePrompt(title);
    const imagePath = await generateImage(imagePrompt, noteId);

    await NotesRepository.getInstance().markReady(new Types.ObjectId(noteId), {
      name: title,
      image: imagePath,
      description: excerpt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await NotesRepository.getInstance().markFailed(
      new Types.ObjectId(noteId),
      message,
    );
    throw err;
  } finally {
    if (uploadPath) {
      await fs.unlink(uploadPath).catch(() => undefined);
    }
  }
}
