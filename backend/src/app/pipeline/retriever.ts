import type { Document } from "@langchain/core/documents";
import { CohereRerank } from "@langchain/cohere";
import { similaritySearch } from "@/app/services/pinecone/pineconeVector";
import "dotenv/config";

/**
 * Vector search only (no Cohere). Call {@link rerankDocuments} once on your fused candidate set.
 */
export async function queryVectorDB(
  query: string,
  filter?: { noteId?: string; userId?: string },
): Promise<Document[]> {
  return similaritySearch(query, 10, filter);
}

export async function rerankDocuments(
  documents: Document[],
  query: string,
  topN = 5,
): Promise<Document[]> {
  if (documents.length === 0) return [];

  if (!process.env.COHERE_API_KEY) {
    return documents.slice(0, topN);
  }

  const cohereRerank = new CohereRerank({
    apiKey: process.env.COHERE_API_KEY,
    model: "rerank-english-v3.0",
  });

  const reranked = await cohereRerank.rerank(documents, query, { topN });
  return reranked
    .map((r) => documents[r.index])
    .filter((d): d is Document => d != null);
}
