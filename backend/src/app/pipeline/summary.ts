import { collapseDocs, splitListOfDocs } from "./util/index.ts";
import { Document } from "@langchain/core/documents";
import { StateGraph, Annotation, Send } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";

// ── Load & split the web page ────────────────────────────────────────────────

const loader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-03-15-prompt-engineering",
);
const docs = await loader.load();
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const splitDocs = await textSplitter.splitDocuments(docs);

// ── LLM ──────────────────────────────────────────────────────────────────────

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

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

// ── Node functions ───────────────────────────────────────────────────────────

// Here we generate a summary, given a document
const generateSummary = async (
  state: SummaryState,
): Promise<{ summaries: string[] }> => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["human", "Write a concise summary of the following:\n\n{context}"],
  ]);
  const chain = prompt.pipe(llm);
  const response = await chain.invoke({ context: state.content });
  return { summaries: [response.content as string] };
};

// Here we define the logic to map out over the documents
// We will use this an edge in the graph
const mapSummaries = (state: typeof OverallState.State) => {
  // Send each content chunk to the generateSummary node
  return state.contents.map(
    (content) => new Send("generateSummary", { content }),
  );
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
  const docLists = splitListOfDocs(
    state.collapsedSummaries,
    await lengthFunction,
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

// ── Run the pipeline ─────────────────────────────────────────────────────────

const result = await app.invoke({
  contents: splitDocs.map((doc) => doc.pageContent),
});

console.log("Final Summary:\n");
console.log(result.finalSummary);
