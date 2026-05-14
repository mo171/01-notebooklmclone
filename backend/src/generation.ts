import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { ChatMistralAI } from "@langchain/mistralai";
import dotenv from "dotenv";
dotenv.config();
import { queryVectorDB, rerankDocuments } from "./retriever.ts";
import { reciprocalRankFusion } from "./RRF.ts";
import { Document } from "@langchain/core/documents";
import { response_generator_promt } from "./prompt.ts";
// import { formatDocumentsAsString } from "langchain/util/document";

const query = "What is Prompt engineering";

const llm = new ChatMistralAI({
    model: "mistral-large-latest",
    temperature: 0.5,
    maxRetries: 2,
    apiKey: process.env.MISTRAL_API_KEY
});


const generate_question_prompt = PromptTemplate.fromTemplate(`
    You are an AI search assistant.
        The user asked: {question}
    
        Step back and consider this question more broadly:
        1. Reframe it in general terms.
        2. Identify the main themes or dimensions involved.
        3. Generate 5 diverse search queries that cover these dimensions,
           ensuring each query explores a different perspective or phrasing.
    `)



const generateQuestionPromt = await generate_question_prompt.invoke({
    question: query,
})

const questionsSchema = z.object({
    questions: z.array(z.string()),
});
const structuredLlm = llm.withStructuredOutput(questionsSchema);

const parsedResult = await structuredLlm.invoke([
    {
        role: "user",
        content: generateQuestionPromt.value,
    },
]);

const questions = parsedResult?.questions

const allRetrievedDocs = [] as Document[][]

for (const question of questions ?? []) {
  const retrieved = await queryVectorDB(question);
  allRetrievedDocs.push(retrieved);
}

const fusedDoc = reciprocalRankFusion(allRetrievedDocs);

function formatDocumentsAsString(docs: Document[]) {
  return docs.map((doc) => doc.pageContent).join("\n\n");
}

const fusedDocuments = fusedDoc
  .map((item) => item.doc)
  .filter((d): d is Document => d != null);

const rerankCandidates = fusedDocuments.slice(0, 30);
const contextDocs = await rerankDocuments(rerankCandidates, query, 5);
const docToString = formatDocumentsAsString(contextDocs);

const generatorResPrompt = await response_generator_promt.invoke({
  original_question: query,
  questions: (questions ?? []).join(","),
  retrieved_docs: docToString,
});

const aiResponse = await llm.invoke([
    {
        role: "user",
        content: generatorResPrompt.value
    }
])

console.log(aiResponse.content)


// const prompt = PromptTemplate.fromTemplate(`
//     You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer which means dint recive any context then say you dont know, just say that you don't know. Use three sentences maximum
// Question: {question}
// Context: {context}
// Answer:
//     `)

// const promptVal = await prompt.invoke({
//     question: query,
//     context: result[0]?.pageContent
// })

// const llmResult = await llm.invoke([
//     {
//         role: "user",
//         content: promptVal.value
//     }
// ])

// console.log(llmResult)
// console.log("////////////////");
// console.log(result[0]?.pageContent);

