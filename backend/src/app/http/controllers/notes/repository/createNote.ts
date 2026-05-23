import { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { GoogleDriveService } from "@/app/services/notes/drive";
import { URLNoteService } from "@/app/services/notes/url";
import { UploadNoteService } from "@/app/services/notes/upload";
import { generateImage } from "@/app/services/notes/generateImage";
import { NotesRepository } from "./Notesrepository";
import { User } from "@/app/bootstrap/models/userSchema";
import { ingestTextToPinecone } from "@/app/pipeline/ingestion-pipeline";

// ── Multer setup ─────────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "tmp", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const multerUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

export const uploadMiddleware = multerUpload.single("file");

// ── Controller ───────────────────────────────────────────────────────────────
export async function createNote(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const driveFileId =
      (req.body?.driveFileId as string | undefined)?.trim() ||
      (req.query?.driveFileId as string | undefined)?.trim();
    const url =
      (req.body?.url as string | undefined)?.trim() ||
      (req.query?.url as string | undefined)?.trim();
    const file = req.file;

    const sources = [Boolean(driveFileId), Boolean(url), Boolean(file)].filter(Boolean);
    if (sources.length !== 1) {
      return res.status(400).json({
        message: "Provide exactly one source: driveFileId, url, or file upload",
      });
    }

    let sourceType: "drive" | "url" | "upload";
    let sourceRef: string | undefined;
    let jobSource: {
      type: "drive" | "url" | "upload";
      driveFileId?: string;
      url?: string;
      uploadPath?: string;
      originalName?: string;
    };

    if (driveFileId) {
      if (!user.googleAccessToken) {
        return res.status(401).json({
          message: "Google Drive access required for Drive files",
        });
      }
      sourceType = "drive";
      sourceRef = driveFileId;
      jobSource = { type: "drive", driveFileId };
    } else if (url) {
      sourceType = "url";
      sourceRef = url;
      jobSource = { type: "url", url };
    } else if (file) {
      sourceType = "upload";
      sourceRef = file.originalname;
      jobSource = { type: "upload", uploadPath: file.path, originalName: file.originalname };
    } else {
      return res.status(400).json({ message: "No valid source provided" });
    }

    // Create the note immediately in "processing" state
    const repo = NotesRepository.getInstance();
    const processingNote = await repo.createProcessingNote({
      userId: user._id,
      sourceType,
      sourceRef,
    });

    // Extract content from the source
    let content: string;
    let noteName: string;

    try {
      switch (sourceType) {
        case "drive": {
          const driveService = GoogleDriveService.getInstance();
          content = await driveService.readFileFromDrive(driveFileId!);
          noteName = `Note from Drive: ${driveFileId}`;
          break;
        }
        case "url": {
          const urlService = URLNoteService.getInstance();
          content = await urlService.readContentFromUrl(url!);
          noteName = `Note from URL: ${url!.length > 50 ? url!.slice(0, 50) + "..." : url}`;
          break;
        }
        case "upload": {
          const uploadService = new UploadNoteService();
          content = await uploadService.readContentFromUpload(file!);
          noteName = `Note from File: ${file!.originalname}`;
          break;
        }
        default:
          throw new Error(`Unsupported source type`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await repo.markFailed(processingNote._id, errorMessage);
      return res.status(400).json({
        message: "Failed to process note source",
        error: errorMessage,
        noteId: processingNote._id,
      });
    }

    // Generate cover image (non-blocking failure — note is still saved)
    let imageUrl = "";
    if (process.env.DISABLE_IMAGE_GENERATION !== "true") {
      try {
        const promptText = `A minimalist abstract digital art for a document: ${content.substring(0, 400)}`;
        imageUrl = await generateImage(promptText, processingNote._id.toString());
      } catch (imageErr) {
        console.error("[createNote] Image generation failed:", imageErr);
      }
    }

    // Mark note as ready in the database
    const updatedNote = await repo.markReady(processingNote._id, {
      name: noteName,
      image: imageUrl,
      description: content,
    });

    // Fire-and-forget: ingest note content into Pinecone for Q&A chat
    ingestTextToPinecone(content, {
      noteId: processingNote._id.toString(),
      userId: user._id.toString(),
    }).catch((err) => {
      console.error("[createNote] Pinecone ingestion failed:", err);
    });

    return res.status(202).json({ note: updatedNote });
  } catch (err) {
    next(err);
  }
}
