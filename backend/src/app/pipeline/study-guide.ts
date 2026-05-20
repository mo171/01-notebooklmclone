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

import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";

// ── Load documents from a webpage (example input) ───────────────────────────

const loader = new CheerioWebBaseLoader(
	"https://lilianweng.github.io/posts/2023-03-15-prompt-engineering",
);
const docs = await loader.load();

const textSplitter = new RecursiveCharacterTextSplitter({
	chunkSize: 1000,
	chunkOverlap: 200,
});
const splitDocs = await textSplitter.splitDocuments(docs);

// ── LLM ─────────────────────────────────────────────────────────────────────

const llm = new ChatOpenAI({
	model: "gpt-4o-mini",
	temperature: 0.5,
	maxRetries: 2,
	apiKey: process.env.OPENAI_API_KEY,
});

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

interface StudyGuideState {
	content: string;
}

// ── Node functions ──────────────────────────────────────────────────────────

const generateStudyGuideChunk = async (
	state: StudyGuideState,
): Promise<{ studyGuides: string[] }> => {
	const prompt = ChatPromptTemplate.fromMessages([
		[
			"human",
			`Write a study guide chunk for the following content.

Requirements:
- Capture key concepts, definitions, and main points
- Preserve important examples when present
- Use clear structure (short headings + bullet points when helpful)

Content:
{content}`,
		],
	]);

	const chain = prompt.pipe(llm);
	const response = await chain.invoke({ content: state.content });
	return { studyGuides: [String(response.content)] };
};

// Map logic
const mapStudyGuides = (state: typeof OverallState.State) => {
	return state.contents.map(
		(content) => new Send("generateStudyGuideChunk", { content }),
	);
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

// ── Run ─────────────────────────────────────────────────────────────────────

const result = await app.invoke({
	contents: splitDocs.map((doc) => doc.pageContent),
});

console.log("Final Study Guide:\n");
console.log(result.finalStudyGuide);

