import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import "dotenv/config";



export async function ingestTextToPinecone(text: string, metadata: Record<string, any> = {}) {
  // Replace large empty spaces
  const cleanedText = text.replace(/\s+/g, " ").trim();

  // chunkoverlap: we use it in order to preverse the meaning of the chunk
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.createDocuments([cleanedText], [metadata]);
  const allSplits = await textSplitter.splitDocuments(docs);

  const embeddings = new HuggingFaceTransformersEmbeddings({
    // apiKey: process.env.HUGGINGFACE_API_KEY as string,
    model: "BAAI/bge-small-en-v1.5", // popular & free model
  });
  
  const pinecone = new PineconeClient({
    apiKey: process.env.PINECONE_API_KEY as string,
  });
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX as string);
  
  const vectorStore = new PineconeStore(embeddings, {
    pineconeIndex,
    maxConcurrency: 5,
  });

  await vectorStore.addDocuments(allSplits);
  console.log('finished indexing...')

  
}
