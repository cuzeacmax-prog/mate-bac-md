/**
 * POST /api/lesson/quiz — ETAPA 67: verificarea răspunsului A-D pe server.
 *
 * Răspunsul corect NU există pe client; lecția persistată în messages (cu
 * corecta) e sursa de adevăr. Literă = nivel DETERMINIST (ETAPA 63) →
 * mastery se mișcă prin recordConceptEvidence; încercarea se persistă în
 * exercise_attempts pentru audit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { recordConceptEvidence } from '@/lib/mastery/evidence';
import type { LessonBlock, QuizBlock } from '@/lib/lesson/blocks';

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
  // mesajul lecției + verificarea proprietarului (conversația userului)
  const { data: msg } = await service
    .from('messages')
    .select('content, conversation_id, conversations(user_id)')
    .eq('id', messageId)
    .maybeSingle();
  const owner = (msg?.conversations as unknown as { user_id: string } | null)?.user_id;
  if (!msg || owner !== user.id) {
    return NextResponse.json({ error: 'Lecția nu există sau nu îți aparține' }, { status: 404 });
  }

  let lesson: { lesson?: boolean; concept?: string; blocks?: LessonBlock[] };
  try {
    lesson = JSON.parse(msg.content as string);
  } catch {
    return NextResponse.json({ error: 'Mesajul nu e o lecție structurată' }, { status: 400 });
  }
  if (!lesson.lesson || !Array.isArray(lesson.blocks)) {
    return NextResponse.json({ error: 'Mesajul nu e o lecție structurată' }, { status: 400 });
  }
  const quizzes = lesson.blocks.filter((b): b is QuizBlock => b.tip === 'quiz');
  const idx = Number(quizId.replace(/^q/, '')) - 1;
  const quiz = quizzes[idx];
  if (!quiz) return NextResponse.json({ error: `Quiz inexistent: ${quizId}` }, { status: 404 });

  // nivel DETERMINIST: literă cu literă (ETAPA 63)
  const correct = quiz.corecta === answer;

  // mastery pe conceptul lecției + urmă de audit
  if (lesson.concept) {
    try {
      await recordConceptEvidence(service, user.id, [lesson.concept], correct, 'chat');
    } catch (err) {
      console.error('[lesson/quiz] evidence failed:', err instanceof Error ? err.message : err);
    }
  }
  const { error: attErr } = await service.from('exercise_attempts').insert({
    user_id: user.id,
    exercise_id: `quiz:${messageId}:${quizId}`,
    is_correct: correct,
    user_answer: answer,
    correct_answer: quiz.corecta,
    session_type: 'chat_ancorat',
    metadata: { conversation_id: msg.conversation_id, method: 'determinist', confidence: 1, lesson_quiz: true },
  });
  if (attErr) console.error('[lesson/quiz] attempt insert failed:', attErr.message);

  return NextResponse.json({ correct, corecta: quiz.corecta });
}
