import { collapseDocs } from "@/util/index";
import { Document } from "@langchain/core/documents";
import { StateGraph, Annotation, Send } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

import "dotenv/config";
import { createChatModel, splitIntoBatches } from "@/util/index";

// ── LLM ──────────────────────────────────────────────────────────────────────

// ── LLM ──────────────────────────────────────────────────────────────────────

const llm = createChatModel({ temperature: 0.7 });
const SUMMARY_BATCH_SIZE = Number(process.env.SUMMARY_BATCH_SIZE ?? 5);

// ── Helpers ──────────────────────────────────────────────────────────────────

let tokenMax = 1000;

function approximateTokens(text: string): number {
  // Roughly: 1 token ≈ 4 characters (English text)
  return Math.ceil(text.length / 4);
}

async function lengthFunction(documents: Document[]) {
  const tokenCounts = documents.map((doc) =>
    approximateTokens(doc.pageContent),
  );
  return tokenCounts.reduce((sum, count) => sum + count, 0);
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

// ── State definitions ────────────────────────────────────────────────────────

const OverallState = Annotation.Root({
  contents: Annotation<string[]>,
  // Notice here we pass a reducer function.
  // This is because we want combine all the summaries we generate
  // from individual nodes back into one list. - this is essentially
  // the "reduce" part
  summaries: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
  }),
  collapsedSummaries: Annotation<Document[]>,
  finalSummary: Annotation<string>,
});

// This will be the state of the node that we will "map" all
// documents to in order to generate summaries
interface SummaryState {
  content: string;
}

interface SummaryBatchState {
  contents: string[];
}

// ── Node functions ───────────────────────────────────────────────────────────

// Here we generate a summary for a batch of chunks
const generateSummary = async (
  state: SummaryBatchState,
): Promise<{ summaries: string[] }> => {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "human",
      "Write one concise summary for the grouped chunks below. Combine repeated ideas and keep the output focused.\n\n{context}",
    ],
  ]);
  const chain = prompt.pipe(llm);
  const response = await chain.invoke({
    context: state.contents
      .map((chunk, index) => `Chunk ${index + 1}:\n${chunk}`)
      .join("\n\n"),
  });
  return { summaries: [response.content as string] };
};

// Group chunks before sending them to the LLM
const mapSummaries = (state: typeof OverallState.State) => {
  const batches = splitIntoBatches(state.contents, SUMMARY_BATCH_SIZE);
  return batches.map((contents) => new Send("generateSummary", { contents }));
};

// Here we will collect all the summaries and collapse them into Document objects
const collectSummaries = async (state: typeof OverallState.State) => {
  return {
    collapsedSummaries: state.summaries.map(
      (summary) => new Document({ pageContent: summary }),
    ),
  };
};

// This represents the conditional check — should we collapse further?
const shouldCollapse = (state: typeof OverallState.State) => {
  // Get the total token count of all collapsed summaries
  const numTokens = state.collapsedSummaries.reduce(
    (sum, doc) => sum + approximateTokens(doc.pageContent),
    0,
  );
  if (numTokens > tokenMax) {
    return "collapseSummaries";
  }
  return "generateFinalSummary";
};

// If the total token count exceeds the max, we collapse the summaries
const collapseSummaries = async (state: typeof OverallState.State) => {
  const docLists = await splitListOfDocs(
    state.collapsedSummaries,
    lengthFunction,
    tokenMax,
  );
  const results: Document[] = [];
  for (const docList of docLists) {
    const collapsePrompt = ChatPromptTemplate.fromMessages([
      ["human", "Collapse this content into a concise summary:\n\n{context}"],
    ]);
    const chain = collapsePrompt.pipe(llm);
    const result = await chain.invoke({
      context: docList.map((d) => d.pageContent).join("\n\n"),
    });
    results.push(new Document({ pageContent: result.content as string }));
  }
  return { collapsedSummaries: results };
};

// Final summary generation
const generateFinalSummary = async (state: typeof OverallState.State) => {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "human",
      "Write a thorough and detailed summary of the following:\n\n{context}",
    ],
  ]);
  const chain = prompt.pipe(llm);
  const response = await chain.invoke({
    context: state.collapsedSummaries
      .map((doc) => doc.pageContent)
      .join("\n\n"),
  });
  return { finalSummary: response.content as string };
};

// ── Construct the graph ──────────────────────────────────────────────────────

const graph = new StateGraph(OverallState)
  .addNode("generateSummary", generateSummary)
  .addNode("collectSummaries", collectSummaries)
  .addNode("collapseSummaries", collapseSummaries)
  .addNode("generateFinalSummary", generateFinalSummary)

  .addConditionalEdges("__start__", mapSummaries, ["generateSummary"])
  .addEdge("generateSummary", "collectSummaries")
  .addConditionalEdges("collectSummaries", shouldCollapse, [
    "collapseSummaries",
    "generateFinalSummary",
  ])
  .addConditionalEdges("collapseSummaries", shouldCollapse, [
    "collapseSummaries",
    "generateFinalSummary",
  ])
  .addEdge("generateFinalSummary", "__end__");

const app = graph.compile();

// ── Exported Pipeline ────────────────────────────────────────────────────────

export async function generateSummaryPipeline(content: string): Promise<string> {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.createDocuments([content]);
  const splitDocs = await textSplitter.splitDocuments(docs);

  const result = await app.invoke({
    contents: splitDocs.map((doc) => doc.pageContent),
  });

  return result.finalSummary;
}
