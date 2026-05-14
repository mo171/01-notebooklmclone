import { Document } from "@langchain/core/documents";

export function reciprocalRankFusion(results:Document[][], k = 60) {
    const fusedScores = new Map();
  
    // Iterate through each ranked list
    for (const docs of results) {
      docs.forEach((doc, rank) => {
        const key = doc.pageContent; // Use pageContent as unique key
        const previousScore = fusedScores.get(key) || 0;
        fusedScores.set(key, previousScore + 1 / (rank + k));
      });
    }
  
    // Convert Map to array of {doc, score} and sort by score descending
    const reranked = Array.from(fusedScores.entries())
      .map(([key, score]) => {
        // Retrieve original document from one of the arrays
        const doc = results.flat().find(d => d.pageContent === key);
        return { doc, score };
      })
      .sort((a, b) => b.score - a.score);
  
    return reranked;
  }