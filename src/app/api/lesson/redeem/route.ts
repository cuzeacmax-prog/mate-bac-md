/**
 * POST /api/lesson/redeem — ETAPA 70 FAZA C: RĂSCUMPĂRAREA după 2 greșeli.
 * Răspunsul elevului pe exercițiul SIMILAR (ales determinist pe server) e
 * evaluat prin nivelurile ETAPEI 63; mastery urcă DOAR la reușita aici.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { processRedemption } from '@/lib/lesson/mistake';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { messageId?: string; quizId?: string; exerciseId?: string; answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  const { messageId, quizId, exerciseId } = body;
  const answer = body.answer?.trim();
  if (!messageId || !quizId || !exerciseId || !answer) {
    return NextResponse.json({ error: 'messageId, quizId, exerciseId și answer sunt obligatorii' }, { status: 400 });
  }
  if (answer.length > 300) {
    return NextResponse.json({ error: 'Răspuns prea lung' }, { status: 400 });
  }

  const service = createServiceClient();
  const result = await processRedemption(service, user.id, messageId, quizId, exerciseId, answer);
  return NextResponse.json(result.body, { status: result.status });
}
