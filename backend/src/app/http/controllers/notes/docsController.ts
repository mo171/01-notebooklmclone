import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { User } from "@/app/bootstrap/models/userSchema";
import { Note } from "@/app/bootstrap/models/notesScchema";
import { Doc } from "@/app/bootstrap/models/docSchema";
import { loadNoteSource } from "@/app/services/notes/loader";
import { ingestTextToPinecone } from "@/app/pipeline/ingestion-pipeline";
import { generateTitle } from "@/app/services/notes/Titlegeneration";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getUser(req: Request, res: Response): InstanceType<typeof User> | null {
  const user = req.user as InstanceType<typeof User> | undefined;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return user;
}

async function createDocFromContent(
  noteId: Types.ObjectId,
  userId: Types.ObjectId,
  title: string,
  content: string
) {
  const doc = await Doc.create({
    title,
    description: content,
    noteId,
    userId,
  });

  // Fire-and-forget: ingest into Pinecone for Q&A
  ingestTextToPinecone(content, {
    noteId: noteId.toString(),
    userId: userId.toString(),
    docId: doc._id.toString(),
  }).catch((err) => console.error("[docsController] Pinecone ingest failed:", err));

  return doc;
}

// ── Controllers ──────────────────────────────────────────────────────────────

/** POST /api/v1/blank/notes — create an empty notebook */
export async function createBlankNote(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const note = await Note.create({
      name: "Untitled Notebook",
      status: "ready",
      sourceType: "upload",
      userId: user._id,
    });

    return res.status(201).json({ newNote: { _id: note._id, title: note.name } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/notes/drive-files — import a Google Drive file into a note */
export async function importDriveFile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { fileId, noteId } = req.body as { fileId?: string; noteId?: string };
    if (!fileId || !noteId) {
      return res.status(400).json({ message: "fileId and noteId are required" });
    }
    if (!Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Invalid noteId" });
    }
    if (!user.googleAccessToken) {
      return res.status(401).json({ message: "Google Drive access token missing" });
    }

    const { fullText } = await loadNoteSource({ type: "drive", driveFileId: fileId, user });
    const title = await generateTitle(fullText).catch(() => `Drive file: ${fileId}`);
    const doc = await createDocFromContent(new Types.ObjectId(noteId), user._id, title, fullText);

    return res.status(201).json({ doc });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/notes/weblinkdata — import content from a URL */
export async function importWebLink(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { webLink, noteId } = req.body as { webLink?: string; noteId?: string };
    if (!webLink || !noteId) {
      return res.status(400).json({ message: "webLink and noteId are required" });
    }
    if (!Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Invalid noteId" });
    }

    const { fullText } = await loadNoteSource({ type: "url", url: webLink });
    const title = await generateTitle(fullText).catch(() => `Web: ${webLink.slice(0, 60)}`);
    const doc = await createDocFromContent(new Types.ObjectId(noteId), user._id, title, fullText);

    return res.status(201).json({ doc });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/notes/text-data — import raw text into a note */
export async function importTextData(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { text, noteId } = req.body as { text?: string; noteId?: string };
    if (!text || !noteId) {
      return res.status(400).json({ message: "text and noteId are required" });
    }
    if (!Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Invalid noteId" });
    }

    const title = await generateTitle(text).catch(() => "Pasted text");
    const doc = await createDocFromContent(new Types.ObjectId(noteId), user._id, title, text);

    return res.status(201).json({ doc });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/notes/youtube-link — import YouTube video transcript */
export async function importYoutubeLink(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { youtubeLink, noteId } = req.body as { youtubeLink?: string; noteId?: string };
    if (!youtubeLink || !noteId) {
      return res.status(400).json({ message: "youtubeLink and noteId are required" });
    }
    if (!Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Invalid noteId" });
    }

    // Load page content from YouTube URL (gets description/metadata via Cheerio)
    const { fullText } = await loadNoteSource({ type: "url", url: youtubeLink });
    const title = await generateTitle(fullText).catch(
      () => `YouTube: ${youtubeLink.slice(0, 60)}`
    );
    const doc = await createDocFromContent(new Types.ObjectId(noteId), user._id, title, fullText);

    return res.status(201).json({ doc });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/notes/source/results — fetch all docs for a note */
export async function getNoteDocs(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { noteId } = req.query as { noteId?: string };
    if (!noteId || !Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Valid noteId is required" });
    }

    const docs = await Doc.find({
      noteId: new Types.ObjectId(noteId),
      userId: user._id,
    }).sort({ createdAt: -1 });

    const sources = docs.map((doc) => {
      let source_type = "doc";
      let content = doc.description ?? "";

      if (doc.mindMap) {
        source_type = "mindMap";
        content = doc.mindMap;
      } else if (doc.briefingDoc) {
        source_type = "audio";
        content = doc.briefingDoc;
      } else if (doc.summary) {
        source_type = "summary";
        content = doc.summary;
      } else if (doc.FAQ) {
        source_type = "faq";
        content = doc.FAQ;
      } else if (doc.studyGuide) {
        source_type = "studyguide";
        content = doc.studyGuide;
      }

      return {
        _id: doc._id,
        title: doc.title,
        content,
        source_type,
        total_source: 1,
        noteId,
        userId: user._id,
      };
    });

    return res.json({ sources });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/notes/search/web — search the web for context */
export async function searchWeb(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { query } = req.query as { query?: string };
    if (!query) {
      return res.status(400).json({ message: "query is required" });
    }

    if (!process.env.TAVILY_API_KEY) {
      return res.status(503).json({ message: "Web search is not configured" });
    }

    const retriever = new TavilySearchAPIRetriever({
      apiKey: process.env.TAVILY_API_KEY,
      k: 5,
    });

    const results = await retriever.invoke(query);
    return res.json({
      results: results.map((r) => ({
        title: r.metadata?.title ?? "",
        link: r.metadata?.source ?? "",
        text: r.pageContent,
      })),
    });
  } catch (err) {
    next(err);
  }
}
