import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { User } from "@/app/bootstrap/models/userSchema";
import { Doc } from "@/app/bootstrap/models/docSchema";
import { generateSummaryPipeline } from "@/app/pipeline/summary";
import { generateBriefingDocPipeline } from "@/app/pipeline/briefing-doc";
import { generateFaqPipeline } from "@/app/pipeline/generate-faq";
import { generateMindMapPipeline } from "@/app/pipeline/mind-map";
import { generateStudyGuidePipeline } from "@/app/pipeline/study-guide";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUser(req: Request, res: Response): InstanceType<typeof User> | null {
  const user = req.user as InstanceType<typeof User> | undefined;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return user;
}

/** Fetch docs by IDs, scoped to user and optionally the notebook */
async function getDocContents(
  docIds: string[],
  userId: Types.ObjectId,
  noteId?: string,
): Promise<InstanceType<typeof Doc>[]> {
  const objectIds = docIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const query: Record<string, unknown> = {
    _id: { $in: objectIds },
    userId,
  };
  if (noteId && Types.ObjectId.isValid(noteId)) {
    query.noteId = new Types.ObjectId(noteId);
  }

  return Doc.find(query);
}

// ── Step-1 Check Endpoints (return ready_to_generate_source) ──────────────────
// These match what the frontend expects first before calling the generate+save routes.

/** POST /api/v1/notes/summary */
export async function checkSummaryReady(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;
    return res.json({ status: "ready_to_generate_source" });
  } catch (err) { next(err); }
}

/** POST /api/v1/notes/faq */
export async function checkFaqReady(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;
    return res.json({ status: "ready_to_generate_source" });
  } catch (err) { next(err); }
}

/** POST /api/v1/notes/studyguide */
export async function checkStudyGuideReady(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;
    return res.json({ status: "ready_to_generate_source" });
  } catch (err) { next(err); }
}

/** POST /api/v1/notes/briefingdoc */
export async function checkBriefingDocReady(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;
    return res.json({ status: "ready_to_generate_source" });
  } catch (err) { next(err); }
}

/** POST /api/v1/notes/mindmap */
export async function checkMindMapReady(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;
    return res.json({ status: "ready_to_generate_source" });
  } catch (err) { next(err); }
}

// ── Step-2 Generate+Save Endpoints ───────────────────────────────────────────

/** POST /api/v1/notes/add/sources — generate summary for selected docs */
export async function saveSummaryToSources(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { noteId, docIds } = req.body as { noteId?: string; docIds?: string[] };
    if (!noteId || !docIds?.length) {
      return res.status(400).json({ message: "noteId and docIds are required" });
    }

    const docs = await getDocContents(docIds, user._id, noteId);
    if (!docs.length) return res.status(404).json({ message: "No matching docs found for this notebook" });

    // Run pipeline on combined content, update each doc
    for (const doc of docs) {
      const content = doc.description ?? "";
      if (!content) continue;
      const summary = await generateSummaryPipeline(content);
      await Doc.findByIdAndUpdate(doc._id, { summary });
    }

    return res.json({ message: "Summary generated and saved successfully" });
  } catch (err) { next(err); }
}

/** POST /api/v1/notes/add/faq/sources — generate FAQ for selected docs */
export async function saveFaqToSources(req: Request, res: Response, next: NextFunction) {
  try {
    console.log("[artifactsController] saveFaqToSources called", req.body);
    const user = getUser(req, res);
    if (!user) return;

    const { noteId, docIds } = req.body as { noteId?: string; docIds?: string[] };
    if (!noteId || !docIds?.length) {
      return res.status(400).json({ message: "noteId and docIds are required" });
    }

    const docs = await getDocContents(docIds, user._id, noteId);
    if (!docs.length) return res.status(404).json({ message: "No matching docs found for this notebook" });

    for (const doc of docs) {
      const content = doc.description ?? "";
      if (!content) continue;
      const faq = await generateFaqPipeline(content);
      await Doc.findByIdAndUpdate(doc._id, { FAQ: faq });
    }

    return res.json({ message: "FAQ generated and saved successfully" });
  } catch (err) { next(err); }
}

/** POST /api/v1/notes/add/studyguide/sources — generate study guide for selected docs */
export async function saveStudyGuideToSources(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { noteId, docIds } = req.body as { noteId?: string; docIds?: string[] };
    if (!noteId || !docIds?.length) {
      return res.status(400).json({ message: "noteId and docIds are required" });
    }

    const docs = await getDocContents(docIds, user._id, noteId);
    if (!docs.length) return res.status(404).json({ message: "No matching docs found for this notebook" });

    for (const doc of docs) {
      const content = doc.description ?? "";
      if (!content) continue;
      const studyGuide = await generateStudyGuidePipeline(content);
      await Doc.findByIdAndUpdate(doc._id, { studyGuide });
    }

    return res.json({ message: "Study guide generated and saved successfully" });
  } catch (err) { next(err); }
}

/** POST /api/v1/notes/add/briefingdoc/sources — generate briefing doc for selected docs */
export async function saveBriefingDocToSources(req: Request, res: Response, next: NextFunction) {
  try {
    console.log("[artifactsController] saveBriefingDocToSources called", req.body);
    const user = getUser(req, res);
    if (!user) return;

    const { noteId, docIds, type } = req.body as {
      noteId?: string;
      docIds?: string[];
      type?: "audio" | "briefing-doc";
    };
    if (!noteId || !docIds?.length) {
      return res.status(400).json({ message: "noteId and docIds are required" });
    }

    const docs = await getDocContents(docIds, user._id, noteId);
    if (!docs.length) return res.status(404).json({ message: "No matching docs found for this notebook" });

    const isAudio = type === "audio";

    for (const doc of docs) {
      const content = doc.description ?? "";
      if (!content) continue;
      const briefingDoc = await generateBriefingDocPipeline(content);
      const titlePrefix = isAudio ? "Audio Overview" : "Briefing Doc";
      await Doc.findByIdAndUpdate(doc._id, {
        briefingDoc,
        title: `${titlePrefix}: ${doc.title}`,
      });
    }

    return res.json({
      message: isAudio
        ? "Audio overview generated successfully"
        : "Briefing doc generated and saved successfully",
    });
  } catch (err) { next(err); }
}

/** POST /api/v1/notes/add/mindmap/sources — generate mind map for selected docs */
export async function saveMindMapToSources(req: Request, res: Response, next: NextFunction) {
  try {
    console.log("[artifactsController] saveMindMapToSources called", req.body);
    const user = getUser(req, res);
    if (!user) return;

    const { noteId, docIds } = req.body as { noteId?: string; docIds?: string[] };
    if (!noteId || !docIds?.length) {
      return res.status(400).json({ message: "noteId and docIds are required" });
    }

    const docs = await getDocContents(docIds, user._id, noteId);
    if (!docs.length) return res.status(404).json({ message: "No matching docs found for this notebook" });

    let updatedCount = 0;

    for (const doc of docs) {
      const content =
        doc.description ??
        doc.summary ??
        doc.studyGuide ??
        doc.briefingDoc ??
        doc.FAQ ??
        "";

      if (!content.trim()) {
        continue;
      }

      const mindMap = await generateMindMapPipeline(content);
      const mindMapJson = typeof mindMap === "string" ? mindMap : JSON.stringify(mindMap);
      console.log("[artifactsController] mindMap nodeData:",
        typeof mindMap === "string" ? mindMap : JSON.stringify(mindMap.nodeData, null, 2),
      );
      await Doc.findByIdAndUpdate(doc._id, {
        mindMap: mindMapJson,
        title: `Mind Map: ${doc.title}`,
      });
      console.log("[artifactsController] saved mindMap length:", mindMapJson.length);
      updatedCount += 1;
    }

    if (updatedCount === 0) {
      return res.status(400).json({
        message: "No source text was available to generate a mind map",
      });
    }

    return res.json({ message: "Mind map generated and saved successfully" });
  } catch (err) { next(err); }
}
