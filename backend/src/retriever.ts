import { Document } from "@langchain/core/documents";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
// import { CohereRerank } from "@langchain/cohere";
import "dotenv/config"

export async function queryVectorDB(query: string) {

    const embeddings = new HuggingFaceTransformersEmbeddings({
        model: "BAAI/bge-small-en-v1.5", // popular & free model
      });
  
    const pinecone = new PineconeClient({
      apiKey: process.env.PINECONE_API_KEY as string,
    });
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX as string);
  
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
    });
    
    const result = await vectorStore.similaritySearch(query, 10);

    return result

  }


const result = await queryVectorDB('what is prompt engineering')
