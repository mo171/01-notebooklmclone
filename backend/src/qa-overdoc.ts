import {
  END,
  START,
  StateGraph,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { ChatMistralAI } from "@langchain/mistralai";
import dotenv from "dotenv";
dotenv.config();
import { queryVectorDB, rerankDocuments } from "./retriever.ts";
import { reciprocalRankFusion } from "./RRF.ts";
import { Document } from "@langchain/core/documents";
import { response_generator_promt } from "./prompt.ts";
import {
  extractMessage,
  generateResponseFormatter,
  gradeDocResponseFormater,
  llm,
  TranformResponseFormatter,
} from "./util/index.ts";
import {
  generate_question_prompt,
  grade_doc_prompt,
  transform_query_prompt,
} from "./prompts/prompts.ts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
// import { formatDocumentsAsString } from "langchain/util/document";

// nextNode,retrievedDoc,filteredDoc,transformQuery
const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  nextNode: Annotation<string>({
    reducer: (previousVal, nextVal) => previousVal ?? nextVal ?? "",
  }),
  newQuery: Annotation<string>({
    reducer: (previousVal, nextVal) => previousVal ?? nextVal ?? "",
  }),
  retrievedDoc: Annotation<string[]>({
    default: () => [],
    reducer: (previousVal, nextVal) => previousVal.concat(nextVal),
  }),

  generateQuestions: Annotation<string[]>({
    default: () => [],
    reducer: (previousVal, nextVal) => previousVal.concat(nextVal),
  }),

  filteredDoc: Annotation<string[]>({
    default: () => [],
    reducer: (previousVal, nextVal) => previousVal.concat(nextVal),
  }),
});

// create the graph
const RetrieverNode = async (state: typeof StateAnnotation.State) => {
  const lastMessage = extractMessage(state, "human");
  const query = lastMessage?.content as string;

  const parser = new JsonOutputParser<{ questions: string[] }>();
  const chain = generate_question_prompt.pipe(llm).pipe(parser);
  let questions: string[] = [];

  try {
    const parsedResult = await chain.invoke({
      question: query,
    });
    questions = parsedResult.questions || [];
  } catch (e) {
    console.error("Failed to parse questions JSON:", e);
    questions = [query]; // fallback to the original query
  }

  const allRetrievedDocs = [] as Document[][];

  for (const question of questions ?? []) {
    const retrieved = await queryVectorDB(question);
    allRetrievedDocs.push(retrieved);
  }

  const fusedDoc = reciprocalRankFusion(allRetrievedDocs);

  return {
    retrievedDoc: fusedDoc.map((item: any) => item.doc).filter((doc: any) => doc !== undefined),
    generateQuestions: questions,
  };
};

const gradeDocNode = async (state: typeof StateAnnotation.State) => {
  const lastMessage = extractMessage(state, "human");
  const allRetrievedDoc = state.retrievedDoc;

  const parser = new JsonOutputParser<{ binaryScore: string }>();
  const chain = grade_doc_prompt.pipe(llm).pipe(parser);
  const allFilteredDoc = [] as Document[];

  for (const doc of allRetrievedDoc) {
    try {
      const parsedResult = await chain.invoke({
        question: lastMessage?.content,
        context: doc?.pageContent,
      });

      if (parsedResult.binaryScore === "yes") {
        allFilteredDoc.push(new Document({ pageContent: doc?.pageContent }));
      }
    } catch (e) {
      console.error("Failed to parse gradeDoc JSON:", e);
      // Fallback: keep the document if grading fails
      allFilteredDoc.push(new Document({ pageContent: doc?.pageContent }));
    }
  }

  return {
    filteredDoc: allFilteredDoc,
  };
};

const transformQuery = async (state: typeof StateAnnotation.State) => {
  const lastMessage = extractMessage(state, "human");

  const parser = new JsonOutputParser<{ question: string }>();
  const chain = transform_query_prompt.pipe(llm).pipe(parser);
  let newQuery = lastMessage?.content as string;

  try {
    const betterQuestion = await chain.invoke({ question: lastMessage?.content });
    newQuery = betterQuestion.question || newQuery;
  } catch (e) {
    console.error("Failed to parse transformQuery JSON:", e);
  }

  return {
    newQuery: newQuery,
  };
};

const webSearch = async (state: typeof StateAnnotation.State) => {
  const query =
    state.newQuery || (extractMessage(state, "human")?.content as string);

  const tool = new TavilySearchAPIRetriever({
    apiKey: process.env.TAVILY_API_KEY,
    k: 5,
  });

  const docs = await tool.invoke(query);

  const webResult = docs.map(
    (doc) =>
      new Document({
        pageContent: doc.pageContent,
        metadata: {
          title: doc.metadata?.title,
          url: doc.metadata?.source,
        },
      }),
  );

  return {
    retrievedDoc: webResult,
  };
};

const generate = async (state: typeof StateAnnotation.State) => {
  const lastMessage = extractMessage(state, "human");

  const formatDocumentsAsString = (docs: any[]) =>
    docs.map((doc) => doc.pageContent).join("\n\n");

  const docToString = formatDocumentsAsString(state.retrievedDoc);

  const parser = new JsonOutputParser<{ reasoning: string, answer: string }>();
  const chain = response_generator_promt.pipe(llm).pipe(parser);
  let result = { reasoning: "", answer: "Failed to generate answer." };

  try {
    result = await chain.invoke({
      original_question: lastMessage.content,
      questions: state.generateQuestions.join("\n"),
      retrieved_docs: docToString,
    });
  } catch (e) {
    console.error("Failed to parse generate response JSON:", e);
  }

  console.log("A.I. reasoning : ", result?.reasoning);

  return {
    messages: [new AIMessage(result?.answer)],
  };
};

const router = (state: typeof StateAnnotation.State) => {
  const filteredDocs = state.filteredDoc;
  if (filteredDocs.length === 0) {
    //no relevant doc find
    return "transformQuery";
  }

  return "generate";
};

const builder = new StateGraph(StateAnnotation)
  .addNode("RetrieverNode", RetrieverNode)
  .addNode("gradeDocNode", gradeDocNode)
  .addNode("generate", generate)
  .addNode("transformQuery", transformQuery)
  .addNode("webSearch", webSearch);

// Build graph
builder.addEdge(START, "RetrieverNode");
builder.addEdge("RetrieverNode", "gradeDocNode");
builder.addConditionalEdges("gradeDocNode", router);
builder.addEdge("transformQuery", "webSearch");
builder.addEdge("webSearch", "generate");
builder.addEdge("generate", END);

// Compile
const app = builder.compile();

const result = await app.invoke(
  {
    messages: [new HumanMessage({ content: "Types of Prompt engineering" })],
  },
  generateResponseFormatter,
);

console.log("result : ", result);
