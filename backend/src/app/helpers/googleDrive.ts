import { Readable } from "stream";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { User } from "@/app/bootstrap/models/userSchema";
import { createDriveClient } from "./googleOAuth";
import fs from "fs/promises";
import os from "os";
import path from "path";

const GOOGLE_DOC_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
]);

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const tmpPath = path.join(
    os.tmpdir(),
    `drive-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`,
  );
  try {
    await fs.writeFile(tmpPath, buffer);
    const loader = new PDFLoader(tmpPath);
    const docs = await loader.load();
    return docs.map((d) => d.pageContent).join("\n\n");
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}

export async function fetchDriveFileText(
  user: InstanceType<typeof User>,
  fileId: string,
): Promise<{ text: string; fileName: string }> {
  const drive = createDriveClient(user);

  const meta = await drive.files.get({
    fileId,
    fields: "mimeType,name",
  });

  const mimeType = meta.data.mimeType ?? "application/octet-stream";
  const fileName = meta.data.name ?? fileId;

  if (GOOGLE_DOC_MIMES.has(mimeType)) {
    const exported = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" },
    );
    return { text: String(exported.data ?? ""), fileName };
  }

  if (mimeType === "application/pdf") {
    const media = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" },
    );
    const buffer = await streamToBuffer(media.data as Readable);
    const text = await extractTextFromPdfBuffer(buffer);
    return { text, fileName };
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript"
  ) {
    const media = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" },
    );
    return { text: String(media.data ?? ""), fileName };
  }

  throw new Error(`Unsupported Drive file type: ${mimeType}`);
}
