import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
	Annotation,
	END,
	Send,
	START,
	StateGraph,
} from "@langchain/langgraph";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

import "dotenv/config";
import { createChatModel, splitIntoBatches } from "@/util/index";

// ── LLM ─────────────────────────────────────────────────────────────────────

// ── LLM ─────────────────────────────────────────────────────────────────────

const llm = createChatModel({ temperature: 0.2 });
const BRIEFING_BATCH_SIZE = Number(process.env.BRIEFING_BATCH_SIZE ?? 5);

// ── Token helpers (approximate) ─────────────────────────────────────────────

const tokenMax = 1200;

function approximateTokens(text: string): number {
	// Roughly: 1 token ≈ 4 characters (English text)
	return Math.ceil(text.length / 4);
}

async function lengthFunction(documents: Document[]) {
	const tokenCounts = documents.map((doc) => approximateTokens(doc.pageContent));
	return tokenCounts.reduce((sum, count) => sum + count, 0);
}

function collapseDocs(input: Document[]): string {
	return input.map((doc) => doc.pageContent).join("\n\n");
}

async function splitListOfDocs(
	documents: Document[],
	lengthFn: (docs: Document[]) => Promise<number>,
	maxTokens: number,
): Promise<Document[][]> {
	if (documents.length === 0) return [];

	const result: Document[][] = [];
	let current: Document[] = [];

	for (const doc of documents) {
		if (current.length === 0) {
			current = [doc];
			continue;
		}

		const nextCandidate = current.concat([doc]);
		const candidateLength = await lengthFn(nextCandidate);

		if (candidateLength > maxTokens) {
			result.push(current);
			current = [doc];
			continue;
		}

		current = nextCandidate;
	}

	if (current.length > 0) result.push(current);
	return result;
}

// ── State definitions ───────────────────────────────────────────────────────

const OverallState = Annotation.Root({
	contents: Annotation<string[]>,

	briefingChunks: Annotation<string[]>({
		reducer: (state, update) => state.concat(update),
		default: () => [],
	}),

	collapsedBriefingChunks: Annotation<Document[]>,
	finalBriefing: Annotation<string>,
});

interface BriefingBatchState {
	contents: string[];
}

// ── Node functions ──────────────────────────────────────────────────────────

// Map: Generate briefing for a batch of chunks
const generateBriefingChunk = async (
	state: BriefingBatchState,
): Promise<{ briefingChunks: string[] }> => {
	const mapPrompt = ChatPromptTemplate.fromMessages([
		[
			"user",
 			`Create one professional briefing document for the grouped text below.
Include:
Combine overlapping ideas and keep the output concise, clear paragraphs.\n\n{context}`,
		],
	]);

	const prompt = await mapPrompt.invoke({
		context: state.contents
			.map((chunk, index) => `Chunk ${index + 1}:\n${chunk}`)
			.join("\n\n"),
	});
	const response = await llm.invoke(prompt);

	return { briefingChunks: [String(response.content)] };
};

// Group chunks before sending them to the LLM
const mapBriefingChunks = (state: typeof OverallState.State) => {
	const batches = splitIntoBatches(state.contents, BRIEFING_BATCH_SIZE);
	return batches.map((contents) => new Send("generateBriefingChunk", { contents }));
};

// Collect all chunks into Documents
const collectBriefingChunks = async (state: typeof OverallState.State) => {
	return {
		collapsedBriefingChunks: state.briefingChunks.map(
			(chunk) => new Document({ pageContent: chunk }),
		),
	};
};

// Reduce function: distill multiple briefing chunks into one
async function reduceBriefingChunks(input: Document[]) {
	const reducePrompt = ChatPromptTemplate.fromMessages([
		[
			"user",
			`You are given multiple briefing document chunks. Combine them into a single, cohesive professional briefing document.

Requirements:
- Remove duplication
- Preserve key ideas, takeaways, and actionable recommendations
- Use clear section headings
- Keep it concise but complete

Chunks:\n\n{docs}`,
		],
	]);

	const chain = reducePrompt.pipe(llm);
	const response = await chain.invoke({ docs: collapseDocs(input) });
	return String(response.content);
}

const shouldCollapse = (state: typeof OverallState.State) => {
	const numTokens = state.collapsedBriefingChunks.reduce(
		(sum, doc) => sum + approximateTokens(doc.pageContent),
		0,
	);
	if (numTokens > tokenMax) return "collapseBriefingChunks";
	return "generateFinalBriefing";
};

const collapseBriefingChunks = async (state: typeof OverallState.State) => {
	const docLists = await splitListOfDocs(
		state.collapsedBriefingChunks,
		lengthFunction,
		tokenMax,
	);

	const results: Document[] = [];
	for (const docList of docLists) {
		const collapsed = await reduceBriefingChunks(docList);
		results.push(new Document({ pageContent: collapsed }));
	}

	return { collapsedBriefingChunks: results };
};

const generateFinalBriefing = async (state: typeof OverallState.State) => {
	const final = await reduceBriefingChunks(state.collapsedBriefingChunks);
	return { finalBriefing: final };
};

// ── Construct the graph ─────────────────────────────────────────────────────

const graph = new StateGraph(OverallState)
	.addNode("generateBriefingChunk", generateBriefingChunk)
	.addNode("collectBriefingChunks", collectBriefingChunks)
	.addNode("collapseBriefingChunks", collapseBriefingChunks)
	.addNode("generateFinalBriefing", generateFinalBriefing)
	.addConditionalEdges(START, mapBriefingChunks, ["generateBriefingChunk"])
	.addEdge("generateBriefingChunk", "collectBriefingChunks")
	.addConditionalEdges("collectBriefingChunks", shouldCollapse, [
		"collapseBriefingChunks",
		"generateFinalBriefing",
	])
	.addConditionalEdges("collapseBriefingChunks", shouldCollapse, [
		"collapseBriefingChunks",
		"generateFinalBriefing",
	])
	.addEdge("generateFinalBriefing", END);

const app = graph.compile();

// ── Exported Pipeline ───────────────────────────────────────────────────────

export async function generateBriefingDocPipeline(content: string): Promise<string> {
	const textSplitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1000,
		chunkOverlap: 200,
	});
	
	const docs = await textSplitter.createDocuments([content]);
	const splitDocs = await textSplitter.splitDocuments(docs);

	const result = await app.invoke({
		contents: splitDocs.map((doc) => doc.pageContent),
	});

	return result.finalBriefing;
}
