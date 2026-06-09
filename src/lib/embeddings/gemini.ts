import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { logApiUsage } from '@/lib/ai/usage-log';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export const EMBEDDING_DIMENSIONS = 1536;

async function embed(text: string, taskType: TaskType): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  } as Parameters<typeof model.embedContent>[0]);
  return result.embedding.values;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return embed(text, TaskType.RETRIEVAL_DOCUMENT);
}

export async function generateEmbeddingForQuery(text: string): Promise<number[]> {
  // ETAPA 66 FAZA A: apelul de runtime (chat) se loghează; API-ul de embedding
  // nu întoarce usage → tokens_input = caractere; cost 0 (free tier Gemini).
  const start = Date.now();
  const vector = await embed(text, TaskType.RETRIEVAL_QUERY);
  void logApiUsage({
    taskName: 'embedding',
    model: 'gemini-embedding-001',
    endpoint: 'embeddings/query',
    inputTokens: text.length,
    outputTokens: 0,
    latencyMsTotal: Date.now() - start,
    costUsd: 0,
  });
  return vector;
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
    await new Promise((r) => setTimeout(r, 100));
  }
  return results;
}
