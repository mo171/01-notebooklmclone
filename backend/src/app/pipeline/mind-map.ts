import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import "dotenv/config";
import { createChatModel } from "@/util/index";

type MindElixirNode = {
	id: string;
	topic: string;
	children?: MindElixirNode[];
};

type MindElixirData = {
	nodeData: MindElixirNode;
};

const IdSchema = z
	.string()
	.min(1)
	.regex(/^[a-zA-Z0-9_-]+$/, "id must be [a-zA-Z0-9_-]");

const TopicSchema = z.string().min(1).max(120);

const MindElixirNodeSchema: z.ZodType<MindElixirNode> = z.lazy(() =>
	z.object({
		id: IdSchema,
		topic: TopicSchema,
		children: z.array(MindElixirNodeSchema).optional(),
	}),
);

const MindElixirDataSchema: z.ZodType<MindElixirData> = z.object({
	nodeData: MindElixirNodeSchema,
});

function extractFirstJsonObject(text: string): string {
	const first = text.indexOf("{");
	const last = text.lastIndexOf("}");

	if (first === -1 || last === -1 || last <= first) {
		throw new Error("No JSON object found in model output");
	}

	return text.slice(first, last + 1);
}

function getDepth(node: MindElixirNode): number {
	if (!node.children || node.children.length === 0) return 1;
	return 1 + Math.max(...node.children.map(getDepth));
}

function getWordCount(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function collectTopicsViolations(
	node: MindElixirNode,
	maxWords: number,
	violations: string[] = [],
): string[] {
	const wordCount = getWordCount(node.topic);
	if (wordCount > maxWords) {
		violations.push(`topic too long (${wordCount} words): "${node.topic}"`);
	}
	for (const child of node.children ?? []) {
		collectTopicsViolations(child, maxWords, violations);
	}
	return violations;
}

function createMindMapLlm() {
	return createChatModel({ temperature: 0.5 });
}

const mindElixirShapeExample = `{
	"nodeData": {
		"id": "root",
		"topic": "<Main Topic>",
		"children": [
			{
				"id": "<unique_id>",
				"topic": "<Short Node Name>",
				"children": [
					{
						"id": "<unique_id>",
						"topic": "<Short Node Name>",
						"children": []
					}
				]
			}
		]
	}
}`;

const prompt = PromptTemplate.fromTemplate(`
You are an expert tutor.

Task: Create a Mind Map in **valid MindElixir JSON format** from the provided study guide.

Output rules (strict):
- Output MUST be a single JSON object.
- Output MUST match this shape exactly: {mindElixirShapeExample}
- Use only keys: nodeData, id, topic, children.
- Use unique string ids using only [a-zA-Z0-9_-].
- Keep every node topic short: 1-5 words.
- Depth limit: maximum 4 levels including root.
- Do not wrap in markdown/code-fences.
- Do not output any extra text.

Study guide text:
{study_guide_text}
`);

const repairPrompt = PromptTemplate.fromTemplate(`
The JSON below is supposed to be a MindElixir mind map, but it is invalid.

Fix it so that it becomes a single valid JSON object that matches the shape exactly:
{mindElixirShapeExample}

Constraints:
- Use only keys: nodeData, id, topic, children.
- ids must match [a-zA-Z0-9_-] and be unique.
- topic must be 1-5 words.
- depth <= 4.
- Output JSON only, no extra text.

Validation / parsing error:
{error}

Bad output:
{bad_output}
`);

async function generateMindElixirMindMap(
	studyGuideText: string,
	maxAttempts = 3,
): Promise<MindElixirData> {
	const llm = createMindMapLlm();
	const chain = prompt.pipe(llm);

	let lastBadOutput = "";
	let lastError = "";

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const response = await chain.invoke({
				study_guide_text: studyGuideText,
				mindElixirShapeExample,
			});
			const rawText = String((response as any)?.content ?? response);
			lastBadOutput = rawText;

			const jsonText = extractFirstJsonObject(rawText);
			const parsed = JSON.parse(jsonText) as unknown;
			const validated = MindElixirDataSchema.parse(parsed);

			// Extra sanity checks that matter for rendering quality.
			const depth = getDepth(validated.nodeData);
			if (depth > 4) {
				throw new Error(`Mind map too deep: depth=${depth} (max 4)`);
			}

			const topicViolations = collectTopicsViolations(validated.nodeData, 5);
			if (topicViolations.length > 0) {
				throw new Error(
					`Some topics exceed 5 words. Example: ${topicViolations[0]}`,
				);
			}

			return validated;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);

			// Repair pass: ask the model to output corrected JSON.
			const fixChain = repairPrompt.pipe(llm);
			const fixResponse = await fixChain.invoke({
				error: lastError,
				bad_output: lastBadOutput,
				mindElixirShapeExample,
			});

			const fixedText = String((fixResponse as any)?.content ?? fixResponse);
			lastBadOutput = fixedText;

			try {
				const jsonText = extractFirstJsonObject(fixedText);
				const parsed = JSON.parse(jsonText) as unknown;
				const validated = MindElixirDataSchema.parse(parsed);

				const depth = getDepth(validated.nodeData);
				if (depth > 4) {
					throw new Error(`Mind map too deep: depth=${depth} (max 4)`);
				}
				const topicViolations = collectTopicsViolations(validated.nodeData, 5);
				if (topicViolations.length > 0) {
					throw new Error(
						`Some topics exceed 5 words. Example: ${topicViolations[0]}`,
					);
				}

				return validated;
			} catch (repairErr) {
				lastError =
					repairErr instanceof Error ? repairErr.message : String(repairErr);
			}
		}
	}

	throw new Error(`Failed to generate a valid mind map: ${lastError}`);
}

// ── Exported Pipeline ─────────────────────────────────────────────────────────────

export async function generateMindMapPipeline(content: string): Promise<any> {
	const mindMap = await generateMindElixirMindMap(content);
	console.log("[mind-map] generated payload:", JSON.stringify(mindMap, null, 2));
	console.log("[mind-map] nodeData:", JSON.stringify(mindMap.nodeData, null, 2));
	return mindMap;
}
