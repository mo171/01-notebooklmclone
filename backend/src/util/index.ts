import { Document } from "@langchain/core/documents";
import { ChatGroq } from "@langchain/groq";
import z from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

type CreateChatModelOptions = {
  temperature?: number;
  maxRetries?: number;
};

export function createChatModel(options: CreateChatModelOptions = {}) {
  if (!process.env.GROK_API_KEY) {
    throw new Error("Missing GROK_API_KEY");
  }

  return new ChatGroq({
    apiKey: process.env.GROK_API_KEY,
    model: "openai/gpt-oss-20b",
    temperature: options.temperature ?? 0.5,
    maxRetries: options.maxRetries ?? 2,
  });
}

export function extractMessage(state: any, messageType: "ai" | "human") {
  const lastMessage = state.messages
    .filter((m: any) => m._getType() === messageType)
    .slice(-1)[0];
  return lastMessage;
}

export const llm = createChatModel();

export const gradeDocResponseFormater = {
  response_format: {
    type: "json_object",
    schema: zodToJsonSchema(
      z
        .object({
          binaryScore: z
            .enum(["yes", "no"])
            .describe("Relevance score 'yes' or 'no'"),
        })
        .describe(
          "Grade the relevance of the retrieved documents to the question. Either 'yes' or 'no'.",
        ),
    ),
  },
};

export const TranformResponseFormatter = {
  response_format: {
    type: "json_object",
    schema: zodToJsonSchema(
      z.object({
        question: z.string(),
      }),
    ),
  },
} as any;

export function splitListOfDocs(docs: Document[], chunkSize: number) {
  const chunks: Document[][] = [];
  for (let i = 0; i < docs.length; i += chunkSize) {
    chunks.push(docs.slice(i, i + chunkSize));
  }
  return chunks;
}

export function splitIntoBatches<T>(items: T[], batchSize: number) {
  const safeBatchSize = Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : 1;
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += safeBatchSize) {
    batches.push(items.slice(index, index + safeBatchSize));
  }

  return batches;
}

export function collapseDocs(docs: Document[]) {
  return docs.map((doc) => doc.pageContent).join("\n\n");
}

export const generateResponseFormatter = {
  response_format: {
    type: "json_object",
    schema: zodToJsonSchema(
      z.object({
        reasoning: z.string(),
        answer: z.string(),
      }),
    ),
  },
} as any;
