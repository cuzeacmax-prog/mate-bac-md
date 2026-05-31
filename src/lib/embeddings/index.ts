/**
 * Dispatcher de embeddings — comutabil prin env EMBEDDING_PROVIDER ('openai' implicit | 'gemini').
 *
 * REGULĂ CRITICĂ: nu amesteca vectori din provideri diferiți în același index pgvector. La schimbarea
 * providerului, RE-EMBED tot (concepte + interogări) cu noul model, ca spațiul să fie consistent.
 *
 * - openai: text-embedding-3-small, 1536 dims (document == query, fără task type).
 * - gemini: gemini-embedding-001, 1536 dims, RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY.
 */
import { openaiEmbed, OPENAI_EMBEDDING_DIMENSIONS, type EmbedResult } from './openai';
import { generateEmbedding as geminiDoc, generateEmbeddingForQuery as geminiQuery } from './gemini';

export type { EmbedResult } from './openai';
export const ACTIVE_PROVIDER = (process.env.EMBEDDING_PROVIDER ?? 'openai').toLowerCase();
export const EMBEDDING_DIMENSIONS = OPENAI_EMBEDDING_DIMENSIONS;

async function geminiWrap(text: string, kind: 'doc' | 'query'): Promise<EmbedResult> {
  const embedding = kind === 'doc' ? await geminiDoc(text) : await geminiQuery(text);
  return { embedding, tokens: 0 }; // Gemini nu raportează tokeni aici
}

/** Embed pentru DOCUMENT (concepte stocate). */
export async function embedDocument(text: string): Promise<EmbedResult> {
  return ACTIVE_PROVIDER === 'gemini' ? geminiWrap(text, 'doc') : openaiEmbed(text);
}

/** Embed pentru INTEROGARE (enunț de exercițiu). Trebuie să fie ACELAȘI model ca documentele. */
export async function embedQuery(text: string): Promise<EmbedResult> {
  return ACTIVE_PROVIDER === 'gemini' ? geminiWrap(text, 'query') : openaiEmbed(text);
}
