import { ChatOpenAI } from "@langchain/openai";
import z from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export function extractMessage(state: any, messageType: "ai" | "human") {
  const lastMessage = state.messages
    .filter((m: any) => m._getType() === messageType)
    .slice(-1)[0];
  return lastMessage;
}

export const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.5,
  maxRetries: 2,
  apiKey: process.env.OPENAI_API_KEY,
});

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

export function splitListOfDocs(docs, chunkSize) {
  const chunks = [];
  for (let i = 0; i < docs.length; i += chunkSize) {
    chunks.push(docs.slice(i, i + chunkSize));
  }
  return chunks;
}

export function collapseDocs(docs) {
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
