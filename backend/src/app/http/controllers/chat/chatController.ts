import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { User } from "@/app/bootstrap/models/userSchema";
import { Chat } from "@/app/bootstrap/models/chatSchema";
import { Doc } from "@/app/bootstrap/models/docSchema";
import { chatGraphApp } from "@/app/pipeline/qa-overdoc";

// ── LLM for doc overview ──────────────────────────────────────────────────────
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.3,
  apiKey: process.env.OPENAI_API_KEY,
});

const docOverviewPrompt = PromptTemplate.fromTemplate(`
You are a document analysis assistant. Given the following document content, your task is to:
1. Write a concise overview of the document (3-5 sentences).
2. Generate 5 insightful questions a reader might want to ask about this content.

Document content:
{content}

IMPORTANT: Return a JSON object with two keys:
- "doc_overview": a string summary of the document
- "questions": an array of 5 question strings

Example: {{"doc_overview": "This document is about...", "questions": ["What is...?", "How does...?", ...]}}
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUser(req: Request, res: Response): InstanceType<typeof User> | null {
  const user = req.user as InstanceType<typeof User> | undefined;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return user;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/v1/chats/history?userId=...&noteId=... */
export async function getChatHistory(req: Request, res: Response, next: NextFunction) {
  try {
    console.log("[chatController] getChatHistory called", req.query);
    const user = getUser(req, res);
    if (!user) return;

    const { noteId } = req.query as { noteId?: string };
    if (!noteId || !Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Valid noteId is required" });
    }

    const chat = await Chat.findOne({
      noteId: new Types.ObjectId(noteId),
      userId: user._id,
    });

    return res.json({ chatHistory: chat?.messages ?? [] });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/chats — send a message and get an AI reply */
export async function sendChatMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getUser(req, res);
    if (!user) return;

    const { noteId, query } = req.body as { noteId?: string; query?: string };
    if (!noteId || !query) {
      return res.status(400).json({ message: "noteId and query are required" });
    }
    if (!Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Invalid noteId" });
    }

    console.log("[chatController] sendChatMessage", { noteId, query: query.slice(0, 120) });

    // Run the LangGraph RAG pipeline scoped to this notebook
    const result = await chatGraphApp.invoke({
      messages: [new HumanMessage({ content: query })],
      noteId,
      userId: user._id.toString(),
    });

    const allMessages = result.messages ?? [];
    const lastAI = allMessages
      .filter((m: { _getType?: () => string }) => m._getType?.() === "ai")
      .pop();
    const answer =
      typeof lastAI?.content === "string" ? lastAI.content : "I was unable to generate a response.";

    // Persist both turns to the Chat document
    const userMessage = { role: "user" as const, content: query };
    const aiMessage = { role: "ai" as const, content: answer };

    await Chat.findOneAndUpdate(
      { noteId: new Types.ObjectId(noteId), userId: user._id },
      { $push: { messages: { $each: [userMessage, aiMessage] } } },
      { upsert: true, new: true }
    );

    return res.json({ message: { ...aiMessage, noteId, userId: user._id } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/notes/docs/overview?noteId=... */
export async function getDocOverview(req: Request, res: Response, next: NextFunction) {
  try {
    console.log("[chatController] getDocOverview called", req.query);
    const user = getUser(req, res);
    if (!user) return;

    const { noteId } = req.query as { noteId?: string };
    if (!noteId || !Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Valid noteId is required" });
    }

    // Aggregate all doc content for this note
    const docs = await Doc.find({ noteId: new Types.ObjectId(noteId), userId: user._id });
    if (docs.length === 0) {
      return res.json({ aiResult: { doc_overview: "", questions: [] } });
    }

    const combinedContent = docs
      .map((d) => d.description ?? "")
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 8000); // cap to avoid token overflow

    const parser = new JsonOutputParser<{ doc_overview: string; questions: string[] }>();
    const chain = docOverviewPrompt.pipe(llm).pipe(parser);

    let aiResult = { doc_overview: "", questions: [] as string[] };
    try {
      aiResult = await chain.invoke({ content: combinedContent });
    } catch (e) {
      console.error("[chatController] doc overview parse failed:", e);
    }

    return res.json({ aiResult });
  } catch (err) {
    next(err);
  }
}
