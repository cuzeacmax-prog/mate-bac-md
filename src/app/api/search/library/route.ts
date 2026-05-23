import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddingForQuery } from '@/lib/embeddings/gemini';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  let body: { query?: string; limit?: number; threshold?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { query, limit = 5, threshold = 0.65 } = body;

  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return NextResponse.json({ error: 'Missing or too short query' }, { status: 400 });
  }

  try {
    const queryEmbedding = await generateEmbeddingForQuery(query.trim());
    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc('match_exercises', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      if (error.message.includes('function match_exercises') || error.code === '42883') {
        return NextResponse.json({
          results: [],
          warning: 'match_exercises RPC not yet applied. Apply supabase/migrations/20260602100000_match_exercises_rpc.sql.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
