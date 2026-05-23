import { Request, Response, NextFunction } from "express";
import { NotesRepository } from "@/app/http/controllers/notes/repository/Notesrepository";
import { generateSummaryPipeline } from "@/app/pipeline/summary";
import { generateBriefingDocPipeline } from "@/app/pipeline/briefing-doc";
import { generateFaqPipeline } from "@/app/pipeline/generate-faq";
import { generateMindMapPipeline } from "@/app/pipeline/mind-map";
import { generateStudyGuidePipeline } from "@/app/pipeline/study-guide";
import { Types } from "mongoose";
import { User } from "@/app/bootstrap/models/userSchema";

export class ArtifactsController {
  private static async getNoteContent(req: Request, res: Response): Promise<string | null> {
    const user = req.user as InstanceType<typeof User> | undefined;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return null;
    }

    const { noteId } = req.params;
    if (!noteId || !Types.ObjectId.isValid(noteId)) {
      res.status(400).json({ message: "Invalid note ID" });
      return null;
    }

    const note = await NotesRepository.getInstance().findByIdForUser(
      new Types.ObjectId(noteId),
      user._id
    );

    if (!note) {
      res.status(404).json({ message: "Note not found" });
      return null;
    }

    if (!note.description) {
      res.status(400).json({ message: "Note has no content to process" });
      return null;
    }

    return note.description;
  }

  static async generateSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const content = await ArtifactsController.getNoteContent(req, res);
      if (!content) return;

      const summary = await generateSummaryPipeline(content);
      return res.json({ summary });
    } catch (error) {
      next(error);
    }
  }

  static async generateBriefingDoc(req: Request, res: Response, next: NextFunction) {
    try {
      const content = await ArtifactsController.getNoteContent(req, res);
      if (!content) return;

      const briefingDoc = await generateBriefingDocPipeline(content);
      return res.json({ briefingDoc });
    } catch (error) {
      next(error);
    }
  }

  static async generateFaq(req: Request, res: Response, next: NextFunction) {
    try {
      const content = await ArtifactsController.getNoteContent(req, res);
      if (!content) return;

      const faq = await generateFaqPipeline(content);
      return res.json({ faq });
    } catch (error) {
      next(error);
    }
  }

  static async generateMindMap(req: Request, res: Response, next: NextFunction) {
    try {
      const content = await ArtifactsController.getNoteContent(req, res);
      if (!content) return;

      const mindMapData = await generateMindMapPipeline(content);
      return res.json({ mindMap: mindMapData });
    } catch (error) {
      next(error);
    }
  }

  static async generateStudyGuide(req: Request, res: Response, next: NextFunction) {
    try {
      const content = await ArtifactsController.getNoteContent(req, res);
      if (!content) return;

      const studyGuide = await generateStudyGuidePipeline(content);
      return res.json({ studyGuide });
    } catch (error) {
      next(error);
    }
  }
}
