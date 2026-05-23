import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { upsertDocuments, isPineconeConfigured } from "@/app/services/pinecone/pineconeVector";
import "dotenv/config";

export async function ingestTextToPinecone(
  text: string,
  metadata: Record<string, string> = {},
) {
  if (!isPineconeConfigured()) {
    console.warn("[ingestion] Pinecone not configured — skipping vector ingest");
    return;
  }

  const cleanedText = text.replace(/\s+/g, " ").trim();
  if (!cleanedText) {
    return;
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 200,
  });

  const splits = await textSplitter.createDocuments([cleanedText], [metadata]);
  if (splits.length === 0) {
    return;
  }

  await upsertDocuments(
    splits.map((doc) => ({
      pageContent: doc.pageContent,
      metadata: doc.metadata as Record<string, unknown>,
    })),
  );

  console.log(`[ingestion] Indexed ${splits.length} chunk(s) to Pinecone`);
}
