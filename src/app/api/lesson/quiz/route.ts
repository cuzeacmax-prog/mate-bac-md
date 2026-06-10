/**
 * POST /api/lesson/quiz — ETAPA 67 + ETAPA 70 FAZA C: verificarea A-D pe
 * server, cu MAȘINA DE STĂRI LA GREȘEALĂ (logica în lib/lesson/mistake.ts,
 * verificabilă scriptat): greșeala 1 → indiciu + reîncearcă; greșeala 2 →
 * micro-recap + rezolvare + exercițiu similar pentru răscumpărare.
 * Corecta NU există pe client; attempt-ul e numărat pe server.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { processQuizAnswer } from '@/lib/lesson/mistake';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });

  let body: { messageId?: string; quizId?: string; answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }
  const { messageId, quizId } = body;
  const answer = body.answer?.trim().toLowerCase();
  if (!messageId || !quizId || !answer || !['a', 'b', 'c', 'd'].includes(answer)) {
    return NextResponse.json({ error: 'messageId, quizId și answer (a-d) sunt obligatorii' }, { status: 400 });
  }

  const service = createServiceClient();
  const result = await processQuizAnswer(
    service, user.id, messageId, quizId, answer as 'a' | 'b' | 'c' | 'd'
  );
  return NextResponse.json(result.body, { status: result.status });
}
