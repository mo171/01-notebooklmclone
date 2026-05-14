import { ChatMistralAI } from "@langchain/mistralai"
import dotenv from "dotenv";

dotenv.config();




const llm = new ChatMistralAI({
    model: "mistral-large-latest",
    temperature: 0,
    maxRetries: 2,
    apiKey: process.env.MISTRAL_API_KEY
});


const aiMsg = await llm.invoke([
    [
        "system",
        "You are a helpful assistant that translates English to French. Translate the user sentence.",
    ],
    ["human", "I love programming."],
])
console.log(aiMsg);