import { NextFunction, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { User } from "@/app/bootstrap/models/userSchema";
import { NotesRepository } from "./Notesrepository";
import { scheduleProcessNote } from "@/app/bootstrap/agenda/agenda";
import type { NoteSourceType } from "@/app/bootstrap/models/notesScchema";

const uploadDir = path.join(process.cwd(), "tmp", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const uploadMiddleware = upload.single("file");

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

    const sources = [
      Boolean(driveFileId),
      Boolean(url),
      Boolean(file),
    ].filter(Boolean);

    if (sources.length !== 1) {
      return res.status(400).json({
        message:
          "Provide exactly one source: driveFileId, url, or file upload",
      });
    }

    let sourceType: NoteSourceType;
    let sourceRef: string | undefined;
    let jobSource: {
      type: NoteSourceType;
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
      jobSource = {
        type: "upload",
        uploadPath: file.path,
        originalName: file.originalname,
      };
    } else {
      return res.status(400).json({ message: "No valid source provided" });
    }

    const note = await NotesRepository.getInstance().createProcessingNote({
      userId: user._id,
      sourceType,
      sourceRef,
    });

    await scheduleProcessNote({
      noteId: note._id.toString(),
      userId: user._id.toString(),
      source: jobSource,
    });

    return res.status(202).json({ note });
  } catch (err) {
    next(err);
  }
}
