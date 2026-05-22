import { PromptTemplate } from "@langchain/core/prompts";
import { llm } from "@/util/index";

const promptImageGenerator = PromptTemplate.fromTemplate(
  `You are an expert prompt engineer for an AI image generator.
Your task is to take the user's input and generate a prompt for an image generator.
The image should be a minimalist and modern vector icon that visually represents the title.
The style should be flat design with clean, simple lines.
The final image must be only the logo with a transparent background.
Return the prompt itself, and nothing more.

Title: {input}`,
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

export async function generateImagePrompt(title: string): Promise<string> {
  const chain = promptImageGenerator.pipe(llm);
  const result = await chain.invoke({ input: title });
  const prompt = extractText((result as { content?: unknown }).content);
  if (!prompt) {
    throw new Error("Image prompt generation returned empty content");
  }
  return prompt;
}
