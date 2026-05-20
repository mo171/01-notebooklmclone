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
	temperature: 0.2,
	maxRetries: 2,
	apiKey: process.env.OPENAI_API_KEY,
});

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

	faqChunks: Annotation<string[]>({
		reducer: (state, update) => state.concat(update),
		default: () => [],
	}),

	collapsedFaqChunks: Annotation<Document[]>,
	finalFAQ: Annotation<string>,
});

interface FAQState {
	content: string;
}

// ── Node functions ──────────────────────────────────────────────────────────

// Map: Generate FAQ for a single chunk
const generateFAQChunk = async (
	state: FAQState,
): Promise<{ faqChunks: string[] }> => {
	const mapPrompt = ChatPromptTemplate.fromMessages([
		[
			"user",
			`Create a set of FAQs (questions and answers) from the following text.
Each FAQ should include:
- A clear question
- A concise, accurate answer
Format as a list of Q&A:\n\n{context}`,
		],
	]);

	const prompt = await mapPrompt.invoke({ context: state.content });
	const response = await llm.invoke(prompt);

	return { faqChunks: [String(response.content)] };
};

// Map logic
const mapFAQChunks = (state: typeof OverallState.State) => {
	return state.contents.map((content) => new Send("generateFAQChunk", { content }));
};

// Collect all chunks into Documents
const collectFAQChunks = async (state: typeof OverallState.State) => {
	return {
		collapsedFaqChunks: state.faqChunks.map(
			(chunk) => new Document({ pageContent: chunk }),
		),
	};
};

// Reduce function: distill multiple FAQ chunks into one
async function reduceFAQChunks(input: Document[]) {
	const reducePrompt = ChatPromptTemplate.fromMessages([
		[
			"user",
			`The following are FAQ chunks:

{docs}

Distill these into a single cohesive FAQ list.
Requirements:
- Remove duplicates and near-duplicates
- Keep questions clear and non-overlapping
- Keep answers concise and factual (based only on the chunks)
- Format strictly as repeated Q/A pairs (Q: ...\nA: ...)`,
		],
	]);

	const chain = reducePrompt.pipe(llm);
	const response = await chain.invoke({ docs: collapseDocs(input) });
	return String(response.content);
}

const shouldCollapse = (state: typeof OverallState.State) => {
	const numTokens = state.collapsedFaqChunks.reduce(
		(sum, doc) => sum + approximateTokens(doc.pageContent),
		0,
	);
	if (numTokens > tokenMax) return "collapseFAQChunks";
	return "generateFinalFAQ";
};

const collapseFAQChunks = async (state: typeof OverallState.State) => {
	const docLists = await splitListOfDocs(
		state.collapsedFaqChunks,
		lengthFunction,
		tokenMax,
	);

	const results: Document[] = [];
	for (const docList of docLists) {
		const collapsed = await reduceFAQChunks(docList);
		results.push(new Document({ pageContent: collapsed }));
	}

	return { collapsedFaqChunks: results };
};

const generateFinalFAQ = async (state: typeof OverallState.State) => {
	const final = await reduceFAQChunks(state.collapsedFaqChunks);
	return { finalFAQ: final };
};

// ── Construct the graph ─────────────────────────────────────────────────────

const graph = new StateGraph(OverallState)
	.addNode("generateFAQChunk", generateFAQChunk)
	.addNode("collectFAQChunks", collectFAQChunks)
	.addNode("collapseFAQChunks", collapseFAQChunks)
	.addNode("generateFinalFAQ", generateFinalFAQ)
	.addConditionalEdges(START, mapFAQChunks, ["generateFAQChunk"])
	.addEdge("generateFAQChunk", "collectFAQChunks")
	.addConditionalEdges("collectFAQChunks", shouldCollapse, [
		"collapseFAQChunks",
		"generateFinalFAQ",
	])
	.addConditionalEdges("collapseFAQChunks", shouldCollapse, [
		"collapseFAQChunks",
		"generateFinalFAQ",
	])
	.addEdge("generateFinalFAQ", END);

const app = graph.compile();

// ── Run ─────────────────────────────────────────────────────────────────────

const result = await app.invoke({
	contents: splitDocs.map((doc) => doc.pageContent),
});

console.log("Final FAQ:\n");
console.log(result.finalFAQ);

