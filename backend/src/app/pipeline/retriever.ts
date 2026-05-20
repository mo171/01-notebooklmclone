import type { Document } from "@langchain/core/documents";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { CohereRerank } from "@langchain/cohere";
import "dotenv/config";

/** Reuse one embedding model load across retrievals (avoids repeated HF dtype / init logs). */
let embeddingsSingleton: HuggingFaceTransformersEmbeddings | null = null;
function getEmbeddings() {
  if (!embeddingsSingleton) {
    embeddingsSingleton = new HuggingFaceTransformersEmbeddings({
      model: "BAAI/bge-small-en-v1.5",
    });
  }
  return embeddingsSingleton;
}

/**
 * Vector search only (no Cohere). Call {@link rerankDocuments} once on your fused candidate set.
 */
export async function queryVectorDB(query: string): Promise<Document[]> {
  const embeddings = getEmbeddings();

  const pinecone = new PineconeClient({
    apiKey: process.env.PINECONE_API_KEY as string,
  });
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX as string);

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    maxConcurrency: 5,
  });

  return vectorStore.similaritySearch(query, 10);
}

export async function rerankDocuments(
  documents: Document[],
  query: string,
  topN = 5
): Promise<Document[]> {
  if (documents.length === 0) return [];

  const cohereRerank = new CohereRerank({
    apiKey: process.env.COHERE_API_KEY,
    model: "rerank-english-v3.0",
  });

  const reranked = await cohereRerank.rerank(documents, query, { topN });
  return reranked.map((r) => documents[r.index]).filter((d): d is Document => d != null);
}
