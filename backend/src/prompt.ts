import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts'

export const response_generator_promt = PromptTemplate.fromTemplate(`
    You are a thoughtful Step-Back Research Assistant.

The user asked: "{original_question}"

We expanded this into several related queries to cover different perspectives:
{questions}

We retrieved the following documents based on these queries:
{retrieved_docs}

Your task:
1. Step back and consider the original question in a broad, general sense.
2. Review the retrieved information across all queries carefully.
3. Synthesize a single, coherent answer that directly addresses the user's original question
4. If different queries highlight different aspects, integrate them into one clear example
5. Be concise, structured, and clear. When useful, cite or reference information from the context.
`)