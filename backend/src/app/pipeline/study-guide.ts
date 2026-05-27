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

const llm = createChatModel({ temperature: 0.5 });
const STUDY_GUIDE_BATCH_SIZE = Number(process.env.STUDY_GUIDE_BATCH_SIZE ?? 5);

// ── Token helpers (approximate) ─────────────────────────────────────────────

const tokenMax = 1000;

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

	// Each node returns chunks of study guide. We reduce them into one array.
	studyGuides: Annotation<string[]>({
		reducer: (state, update) => state.concat(update),
		default: () => [],
	}),

	collapsedStudyGuides: Annotation<Document[]>,
	finalStudyGuide: Annotation<string>,
});

interface StudyGuideBatchState {
	contents: string[];
}

// ── Node functions ──────────────────────────────────────────────────────────

// Generate a study guide for a batch of chunks
const generateStudyGuideChunk = async (
	state: StudyGuideBatchState,
): Promise<{ studyGuides: string[] }> => {
	const prompt = ChatPromptTemplate.fromMessages([
		[
			"human",
 			`Write one study guide for the grouped content below.

Requirements:
- Capture key concepts, definitions, and main points
- Preserve important examples when present
- Use clear structure (short headings + bullet points when helpful)
			- Combine overlapping points from the grouped chunks into a single output

Content:
{content}`,
		],
	]);

	const chain = prompt.pipe(llm);
	const response = await chain.invoke({
		content: state.contents
			.map((chunk, index) => `Chunk ${index + 1}:\n${chunk}`)
			.join("\n\n"),
	});
	return { studyGuides: [String(response.content)] };
};

// Group chunks before sending them to the LLM
const mapStudyGuides = (state: typeof OverallState.State) => {
	const batches = splitIntoBatches(state.contents, STUDY_GUIDE_BATCH_SIZE);
	return batches.map((contents) => new Send("generateStudyGuideChunk", { contents }));
};

// Collect all chunks into Documents
const collectStudyGuides = async (state: typeof OverallState.State) => {
	return {
		collapsedStudyGuides: state.studyGuides.map(
			(guide) => new Document({ pageContent: guide }),
		),
	};
};

// Reduce function: distill multiple chunks into one
async function reduceStudyGuides(input: Document[]) {
	const reducePrompt = ChatPromptTemplate.fromMessages([
		[
			"human",
			`The following are study guide chunks:

{docs}

Distill these into a single cohesive study guide.
Maintain key concepts, examples, and main points.`,
		],
	]);

	const chain = reducePrompt.pipe(llm);
	const response = await chain.invoke({ docs: collapseDocs(input) });
	return String(response.content);
}

const shouldCollapse = (state: typeof OverallState.State) => {
	const numTokens = state.collapsedStudyGuides.reduce(
		(sum, doc) => sum + approximateTokens(doc.pageContent),
		0,
	);

	if (numTokens > tokenMax) return "collapseStudyGuides";
	return "generateFinalStudyGuide";
};

const collapseStudyGuides = async (state: typeof OverallState.State) => {
	const docLists = await splitListOfDocs(
		state.collapsedStudyGuides,
		lengthFunction,
		tokenMax,
	);

	const results: Document[] = [];
	for (const docList of docLists) {
		const collapsed = await reduceStudyGuides(docList);
		results.push(new Document({ pageContent: collapsed }));
	}

	return { collapsedStudyGuides: results };
};

const generateFinalStudyGuide = async (state: typeof OverallState.State) => {
	const final = await reduceStudyGuides(state.collapsedStudyGuides);
	return { finalStudyGuide: final };
};

// ── Construct the graph ─────────────────────────────────────────────────────

const graph = new StateGraph(OverallState)
	.addNode("generateStudyGuideChunk", generateStudyGuideChunk)
	.addNode("collectStudyGuides", collectStudyGuides)
	.addNode("collapseStudyGuides", collapseStudyGuides)
	.addNode("generateFinalStudyGuide", generateFinalStudyGuide)

	.addConditionalEdges(START, mapStudyGuides, ["generateStudyGuideChunk"])
	.addEdge("generateStudyGuideChunk", "collectStudyGuides")
	.addConditionalEdges("collectStudyGuides", shouldCollapse, [
		"collapseStudyGuides",
		"generateFinalStudyGuide",
	])
	.addConditionalEdges("collapseStudyGuides", shouldCollapse, [
		"collapseStudyGuides",
		"generateFinalStudyGuide",
	])
	.addEdge("generateFinalStudyGuide", END);

const app = graph.compile();

// ── Exported Pipeline ───────────────────────────────────────────────────────

export async function generateStudyGuidePipeline(content: string): Promise<string> {
	const textSplitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1000,
		chunkOverlap: 200,
	});
	
	const docs = await textSplitter.createDocuments([content]);
	const splitDocs = await textSplitter.splitDocuments(docs);

	const result = await app.invoke({
		contents: splitDocs.map((doc) => doc.pageContent),
	});

	return result.finalStudyGuide;
}
