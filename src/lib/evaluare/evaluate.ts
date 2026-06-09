/**
 * evaluate.ts — ETAPA 63: orchestratorul evaluării unei încercări în chat-ul
 * ancorat în concept.
 *
 * Fluxul: exercițiul curent (primul din ancoră fără încercare corectă în
 * conversație) → Nivel A (determinist, doar linkuri 'strict-bijectiv' cu
 * răspuns mono-parte) → altfel Nivel B (judecător Haiku; confidence < 0.8
 * nu mișcă mastery). Fiecare evaluare se persistă în exercise_attempts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConceptAnchor } from "@/lib/concepts/anchor";
import { detectAnswerAttempt } from "./detect";
import { compareAnswers } from "./compare";
import { judgeAnswer } from "./judge";

export const JUDGE_CONFIDENCE_THRESHOLD = 0.8;

/** răspuns oficial multi-parte ("a) ... b) ...") → nu se compară determinist */
const MULTIPART_RE = /(^|[^a-zăâîșț])[a-e]\)\s/i;

export interface AttemptEvaluation {
  exerciseId: string;
  /** null = evaluat dar fără verdict de încredere (nu mișcă mastery) */
  correct: boolean | null;
  method: "determinist" | "judecator";
  confidence: number;
  motiv: string;
  officialAnswer: string | null;
}

/** Răspunsul oficial neambiguu (DOAR match_confidence='strict-bijectiv'). */
export async function getOfficialAnswer(
  service: SupabaseClient,
  exerciseId: string
): Promise<string | null> {
  const { data, error } = await service
    .from("exercise_answer_link")
    .select("answer_id, exercise_answers(answer_text)")
    .eq("exercise_id", exerciseId)
    .eq("match_confidence", "strict-bijectiv")
    .maybeSingle();
  if (error) {
    console.error("[evaluare] official answer lookup failed:", error.message);
    return null;
  }
  const answers = data?.exercise_answers as { answer_text: string } | { answer_text: string }[] | null;
  if (!answers) return null;
  const row = Array.isArray(answers) ? answers[0] : answers;
  return row?.answer_text ?? null;
}

/**
 * Exercițiul „curent" al conversației ancorate: primul exercițiu din ancoră
 * (în ordinea servirii) fără încercare corectă a userului în această conversație.
 */
export async function pickCurrentExercise(
  service: SupabaseClient,
  userId: string,
  conversationId: string,
  anchor: ConceptAnchor
): Promise<{ id: string; statement: string } | null> {
  if (anchor.exercises.length === 0) return null;
  const ids = anchor.exercises.map((e) => e.id);
  const { data, error } = await service
    .from("exercise_attempts")
    .select("exercise_id, is_correct")
    .eq("user_id", userId)
    .eq("session_type", "chat_ancorat")
    .in("exercise_id", ids)
    .contains("metadata", { conversation_id: conversationId });
  if (error) {
    console.error("[evaluare] attempts lookup failed:", error.message);
    return anchor.exercises[0];
  }
  const solved = new Set(
    (data ?? []).filter((a) => a.is_correct === true).map((a) => a.exercise_id as string)
  );
  const next = anchor.exercises.find((e) => !solved.has(e.id));
  return next ?? null;
}

/**
 * Evaluează încercarea elevului pe exercițiul curent.
 * Întoarce null când mesajul nu e o încercare sau nu există exercițiu curent.
 */
export async function evaluateAttempt(
  service: SupabaseClient,
  params: {
    userId: string;
    conversationId: string;
    message: string;
    exercise: { id: string; statement: string };
  }
): Promise<AttemptEvaluation | null> {
  const { userId, conversationId, message, exercise } = params;

  const detection = detectAnswerAttempt(message);
  if (!detection.isAttempt) return null;

  const officialAnswer = await getOfficialAnswer(service, exercise.id);

  let evaluation: AttemptEvaluation | null = null;

  // ── Nivel A: determinist (răspuns oficial neambiguu, mono-parte) ──────────
  if (officialAnswer && !MULTIPART_RE.test(officialAnswer)) {
    const verdict = compareAnswers(officialAnswer, detection.candidate);
    if (verdict.comparable) {
      evaluation = {
        exerciseId: exercise.id,
        correct: verdict.correct,
        method: "determinist",
        confidence: 1,
        motiv: verdict.correct ? "potrivire cu răspunsul oficial" : "diferă de răspunsul oficial",
        officialAnswer,
      };
    }
  }

  // ── Nivel B: judecător (izolat — doar enunț + răspuns elev + oficial) ─────
  if (!evaluation) {
    const verdict = await judgeAnswer({
      statement: exercise.statement,
      studentAnswer: detection.candidate,
      officialAnswer,
    });
    if (!verdict) return null; // judecătorul a eșuat — fără verdict, fără mastery
    evaluation = {
      exerciseId: exercise.id,
      correct: verdict.confidence >= JUDGE_CONFIDENCE_THRESHOLD ? verdict.correct : null,
      method: "judecator",
      confidence: verdict.confidence,
      motiv: verdict.motiv,
      officialAnswer,
    };
  }

  // ── Persistă încercarea (audit + selecția exercițiului următor) ───────────
  const { error: insErr } = await service.from("exercise_attempts").insert({
    user_id: userId,
    exercise_id: exercise.id,
    is_correct: evaluation.correct,
    user_answer: detection.candidate.slice(0, 500),
    correct_answer: officialAnswer ? officialAnswer.slice(0, 500) : null,
    session_type: "chat_ancorat",
    metadata: {
      conversation_id: conversationId,
      method: evaluation.method,
      confidence: evaluation.confidence,
      motiv: evaluation.motiv,
    },
  });
  if (insErr) console.error("[evaluare] attempt insert failed:", insErr.message);

  return evaluation;
}
