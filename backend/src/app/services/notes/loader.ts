import fs from "fs/promises";
import path from "path";
import { Document } from "@langchain/core/documents";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { User } from "@/app/bootstrap/models/userSchema";
import { fetchDriveFileText } from "@/app/helpers/googleDrive";

export type NoteSourceInput =
  | { type: "url"; url: string }
  | { type: "drive"; driveFileId: string; user: InstanceType<typeof User> }
  | { type: "upload"; uploadPath: string; originalName?: string };

const MAX_TITLE_TEXT_CHARS = 12_000;

function normalizeDocs(docs: Document[]) {
  docs.forEach((doc) => {
    doc.pageContent = doc.pageContent.replace(/\s+/g, " ").trim();
  });
}

async function loadFromUrl(url: string): Promise<Document[]> {
  try {
    const loader = new CheerioWebBaseLoader(url, { selector: "main" });
    return await loader.load();
  } catch {
    const loader = new CheerioWebBaseLoader(url, { selector: "body" });
    return await loader.load();
  }
}

async function loadFromUpload(uploadPath: string): Promise<Document[]> {
  const ext = path.extname(uploadPath).toLowerCase();

  if (ext === ".pdf") {
    const loader = new PDFLoader(uploadPath);
    return loader.load();
  }

  const raw = await fs.readFile(uploadPath, "utf-8");
  return [
    new Document({
      pageContent: raw,
      metadata: { source: uploadPath },
    }),
  ];
}

export async function loadNoteSource(source: NoteSourceInput): Promise<{
  fullText: string;
  chunks: Document[];
  excerpt: string;
}> {
  let docs: Document[];

  if (source.type === "url") {
    docs = await loadFromUrl(source.url);
  } else if (source.type === "drive") {
    const { text } = await fetchDriveFileText(source.user, source.driveFileId);
    docs = [
      new Document({
        pageContent: text,
        metadata: { source: source.driveFileId },
      }),
    ];
  } else {
    docs = await loadFromUpload(source.uploadPath);
  }

  normalizeDocs(docs);

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 200,
  });
  const chunks = await textSplitter.splitDocuments(docs);

  const fullText = chunks
    .map((c) => c.pageContent)
    .join("\n\n")
    .slice(0, MAX_TITLE_TEXT_CHARS);

  if (!fullText.trim()) {
    throw new Error("No text could be extracted from the source");
  }

  const excerpt = fullText.slice(0, 300);

  return { fullText, chunks, excerpt };
}
