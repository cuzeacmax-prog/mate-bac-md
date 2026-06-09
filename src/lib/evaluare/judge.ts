/**
 * judge.ts — ETAPA 63 P3 (Nivel B): judecătorul LLM (Haiku prin router,
 * task 'judge_answer', temperatura 0).
 *
 * Izolat deliberat: judecătorul NU vede conversația — primește DOAR enunțul,
 * răspunsul elevului și (dacă există) răspunsul oficial. Răspunde JSON strict.
 * confidence < 0.8 → apelantul NU mișcă mastery (doar expunere).
 */
import { callAI } from "@/lib/ai/router";

export interface JudgeVerdict {
  correct: boolean;
  confidence: number;
  motiv: string;
}

const JUDGE_SYSTEM = `Ești un corector de matematică strict pentru BAC (Republica Moldova).
Primești un enunț de exercițiu, încercarea de răspuns a unui elev și, opțional, răspunsul oficial din culegere.

Sarcina ta: decide dacă încercarea elevului este un răspuns final CORECT la exercițiu.

Reguli stricte:
1. Compari DOAR rezultatul final, nu metoda. Echivalențele matematice contează (1/2 = 0.5 = 50%).
2. Dacă există răspuns oficial, el este sursa de adevăr. Dacă răspunsul oficial are mai multe subpuncte (a, b, c...), potrivește subpunctul relevant; dacă nu poți identifica subpunctul, scade confidence.
3. Dacă elevul dă doar pași intermediari fără rezultat final, correct=false cu motiv "fără răspuns final" și confidence ≤ 0.5.
4. Dacă enunțul e ambiguu sau informația nu ajunge pentru un verdict sigur, scade confidence sub 0.8.
5. NU inventezi răspunsul oficial. Fără răspuns oficial, rezolvi tu exercițiul doar dacă e simplu și ești sigur; altfel confidence < 0.8.

Răspunzi EXCLUSIV cu JSON valid, fără alt text:
{"correct": true|false, "confidence": 0.0-1.0, "motiv": "explicație scurtă în română (max 15 cuvinte)"}`;

export async function judgeAnswer(params: {
  statement: string;
  studentAnswer: string;
  officialAnswer?: string | null;
  /** pentru atribuirea costului în api_usage_log */
  userId?: string | null;
}): Promise<JudgeVerdict | null> {
  const { statement, studentAnswer, officialAnswer } = params;
  const userContent = [
    `ENUNȚ:\n${statement}`,
    officialAnswer ? `RĂSPUNS OFICIAL (culegere):\n${officialAnswer}` : null,
    `RĂSPUNSUL ELEVULUI:\n${studentAnswer}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await callAI("judge_answer", [{ role: "user", content: userContent }], {
      system: JUDGE_SYSTEM,
      userId: params.userId ?? null,
    });
    const raw = result.text.trim().replace(/^```(json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" && parsed !== null &&
      typeof (parsed as JudgeVerdict).correct === "boolean" &&
      typeof (parsed as JudgeVerdict).confidence === "number"
    ) {
      const v = parsed as JudgeVerdict;
      return {
        correct: v.correct,
        confidence: Math.max(0, Math.min(1, v.confidence)),
        motiv: typeof v.motiv === "string" ? v.motiv.slice(0, 200) : "",
      };
    }
    console.error("[evaluare/judge] JSON cu formă neașteptată:", raw.slice(0, 200));
    return null;
  } catch (err) {
    console.error("[evaluare/judge] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
