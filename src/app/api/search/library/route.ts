import { NextRequest, NextResponse } from 'next/server';
// import { generateEmbedding } from '@/lib/embeddings/gemini';
// import { createServiceClient } from '@/lib/supabase/service';

// RAG Search endpoint — requires solved_exercises populated with embeddings.
// Apply supabase/migrations/20260602100000_match_exercises_rpc.sql before activating.

export async function POST(req: NextRequest) {
  let body: { query?: string; limit?: number; threshold?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { query, limit = 5, threshold = 0.5 } = body;

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  // TODO: Activate after solved_exercises is populated and migration applied:
  //
  // const queryEmbedding = await generateEmbedding(query);
  // const supabase = createServiceClient();
  // const { data, error } = await supabase.rpc('match_exercises', {
  //   query_embedding: queryEmbedding,
  //   match_threshold: threshold,
  //   match_count: limit,
  // });
  // if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // return NextResponse.json({ results: data });

  return NextResponse.json({
    note: 'RAG endpoint ready. Requires: (1) solved_exercises populated, (2) match_exercises RPC migration applied.',
    query,
    limit,
    threshold,
    results: [],
  });
}
