import { randomUUID } from "crypto";
import { Document } from "@langchain/core/documents";
import { Pinecone } from "@pinecone-database/pinecone";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";

const TEXT_KEY = "text";
const BATCH_SIZE = 100;

let embeddingsSingleton: HuggingFaceTransformersEmbeddings | null = null;

function getEmbeddings() {
  if (!embeddingsSingleton) {
    embeddingsSingleton = new HuggingFaceTransformersEmbeddings({
      model: "BAAI/bge-small-en-v1.5",
    });
  }
  return embeddingsSingleton;
}

function getPineconeIndex() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;
  if (!apiKey || !indexName) {
    return null;
  }
  const client = new Pinecone({ apiKey });
  return client.index(indexName);
}

function toMetadata(
  meta: Record<string, unknown>,
  pageContent: string,
): Record<string, string> {
  const out: Record<string, string> = {
    [TEXT_KEY]: pageContent.slice(0, 39000),
  };
  for (const [key, value] of Object.entries(meta)) {
    if (value == null || typeof value === "object") continue;
    out[key] = String(value);
  }
  return out;
}

export function isPineconeConfigured() {
  return Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
}

export async function upsertDocuments(
  splits: Array<{ pageContent: string; metadata: Record<string, unknown> }>,
) {
  const index = getPineconeIndex();
  if (!index) {
    console.warn("[pinecone] Not configured — skipping vector upsert");
    return;
  }
  if (splits.length === 0) {
    return;
  }

  const embeddings = getEmbeddings();
  const vectors = await embeddings.embedDocuments(
    splits.map((s) => s.pageContent),
  );

  const records = splits.map((split, i) => ({
    id: randomUUID(),
    values: vectors[i],
    metadata: toMetadata(split.metadata, split.pageContent),
  }));

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    await index.upsert(records.slice(i, i + BATCH_SIZE));
  }
}

export async function similaritySearch(
  query: string,
  topK = 10,
): Promise<Document[]> {
  const index = getPineconeIndex();
  if (!index) {
    return [];
  }

  const embeddings = getEmbeddings();
  const vector = await embeddings.embedQuery(query);

  const result = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });

  return (result.matches ?? [])
    .map((match) => {
      const meta = (match.metadata ?? {}) as Record<string, unknown>;
      const pageContent =
        (meta[TEXT_KEY] as string) ?? (meta.text as string) ?? "";
      return new Document({ pageContent, metadata: meta });
    })
    .filter((doc) => doc.pageContent.length > 0);
}
