/**
 * POST /api/lesson/try — ETAPA 81 FAZA B4: verificarea pasului „încearcă tu".
 * `expected` NU există pe client (stripat la stream, ca `corecta`). Verificare
 * DETERMINISTĂ (compareAnswers, ETAPA 63). Mastery urcă DOAR la reușită:
 * curată = greutate 1; cu hint = ½ (ETAPA 70-D). Greșit → nu penalizează (formativ).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { compareAnswers } from '@/lib/evaluare/compare';
import { recordConceptEvidence, HELPED_WEIGHT } from '@/lib/mastery/evidence';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { messageId?: string; tryId?: string; answer?: string; usedHint?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body invalid' }, { status: 400 }); }
  const { messageId, tryId } = body;
  const answer = (body.answer ?? '').trim();
  if (!messageId || !tryId || !answer) return NextResponse.json({ error: 'messageId, tryId, answer obligatorii' }, { status: 400 });

  const service = createServiceClient();
  const { data: msg } = await service.from('messages').select('content').eq('id', messageId).single();
  if (!msg) return NextResponse.json({ error: 'Lecție inexistentă' }, { status: 404 });
  let parsed: { concept?: string; blocks?: Array<{ tip: string; expected?: string }> };
  try { parsed = JSON.parse(msg.content as string); } catch { return NextResponse.json({ error: 'conținut invalid' }, { status: 500 }); }

  const tries = (parsed.blocks ?? []).filter((b) => b.tip === 'try_step');
  const idx = parseInt(tryId.replace(/^t/, ''), 10) - 1;
  const block = tries[idx];
  if (!block || !block.expected) return NextResponse.json({ error: 'pas inexistent' }, { status: 404 });

  const verdict = compareAnswers(block.expected, answer);
  const correct = verdict.comparable && verdict.correct;

  if (correct && parsed.concept) {
    // curată = 1; cu hint = ½ (ETAPA 70-D). Greșit → niciun efect (formativ).
    await recordConceptEvidence(service, user.id, [parsed.concept], true, 'exercise', body.usedHint ? HELPED_WEIGHT : 1);
  }
  return NextResponse.json({ correct, comparable: verdict.comparable });
}
