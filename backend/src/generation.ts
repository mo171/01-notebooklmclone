import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts'
import z from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { ChatMistralAI } from "@langchain/mistralai"
import dotenv from "dotenv";
dotenv.config();
import { queryVectorDB } from "./retriever.ts"; 



const query = 'What is Prompt engineering'

const result = await queryVectorDB(query)


const llm = new ChatMistralAI({
    model: "mistral-large-latest",
    temperature: 0.5,
    maxRetries: 2,
    apiKey: process.env.MISTRAL_API_KEY
});


const prompt = PromptTemplate.fromTemplate(`
    You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer which means dint recive any context then say you dont know, just say that you don't know. Use three sentences maximum
Question: {question}
Context: {context}
Answer:
    `)

const promptVal = await prompt.invoke({
    question: query,
    context: result[0]?.pageContent
})

const llmResult = await llm.invoke([
    {
        role: "user",
        content: promptVal.value
    }
])

console.log(llmResult)
console.log("////////////////");
console.log(result[0]?.pageContent);

