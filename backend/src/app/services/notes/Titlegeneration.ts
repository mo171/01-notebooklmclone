import { PromptTemplate } from "@langchain/core/prompts";
import { llm } from "@/util/index";

const titlePrompt = PromptTemplate.fromTemplate(
  `You are an expert at naming knowledge notebooks.
Read the following document excerpt and produce a short, clear notebook title (3 to 8 words).
Return only the title text with no quotes or extra commentary.

Document:
{input}`,
);

function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String((part as { text: string }).text)
          : "",
      )
      .join("")
      .trim();
  }
  return String(content ?? "").trim();
}

export async function generateTitle(text: string): Promise<string> {
  const chain = titlePrompt.pipe(llm);
  const result = await chain.invoke({ input: text });
  const title = extractText((result as { content?: unknown }).content);
  if (!title) {
    throw new Error("Title generation returned empty content");
  }
  return title;
}
