/**
 * Provider OpenAI pentru embeddings — text-embedding-3-small, 1536 dims.
 * Potrivire directă cu schema pgvector(1536). Billing OpenAI (deja activ pt. TTS), fără cota Gemini.
 * Vectorii OpenAI vin deja la normă ~1.0; normalizarea L2 din apelant rămâne un no-op sigur.
 */

export const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
export const OPENAI_EMBEDDING_DIMENSIONS = 1536;

export interface EmbedResult {
  embedding: number[];
  tokens: number;
}

export async function openaiEmbed(text: string): Promise<EmbedResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Lipsește OPENAI_API_KEY.');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: text, dimensions: OPENAI_EMBEDDING_DIMENSIONS }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }>; usage?: { total_tokens?: number } };
  const embedding = json.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error('Răspuns OpenAI fără embedding.');
  return { embedding, tokens: json.usage?.total_tokens ?? 0 };
}
