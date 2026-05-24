/**
 * src/lib/chat/query-decomposer.ts
 *
 * Detectează dacă un query conține mai multe exerciții independente (multi-exercise).
 *
 * Pipeline:
 *  1. Regex fast-path — dacă nu există markeri de multi-exercise → SKIP Haiku (zero cost)
 *  2. Haiku call — detectare și separare via LLM (ieftin: ~$0.0003/req)
 *  3. Fallback — returnează query ca un singur exercițiu
 *
 * Exemple:
 *  - "Rezolvă x² - 5x + 6 = 0" → single, nu apelăm Haiku
 *  - "1) Rezolvă x²-5x+6=0  2) Calculează ∫3x²dx" → multi, apelăm Haiku
 *  - "a) Aflați derivata b) Monotonia" → single (sub-puncte ale aceeași funcții)
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Tipuri ───────────────────────────────────────────────────────────────────

export type ExerciseType =
  | 'equation_quadratic'
  | 'equation_linear'
  | 'integral_simple'
  | 'geometry_3d'
  | 'limit'
  | 'derivative'
  | 'inequality'
  | 'logarithm'
  | 'complex_number'
  | 'matrix'
  | 'trigonometry'
  | 'probability'
  | 'combinatorics'
  | 'sequence'
  | 'function_analysis'
  | 'other';

export interface SubExercise {
  id: number;
  text: string;
  detectedType: ExerciseType;
}

export interface DecomposedQuery {
  isMulti: boolean;
  exercises: SubExercise[];
  rawQuery: string;
}

// ─── Regex fast-path ──────────────────────────────────────────────────────────

/**
 * Detectează rapid dacă query-ul pare să aibă multiple exerciții independente.
 * Dacă regex-ul NU găsește markeri → skip Haiku (cel mai frecvent caz).
 */
function hasMultiExerciseMarkers(query: string): boolean {
  // Markeri de exerciții independente: "1)", "2)", "1.", "2.", "Exercițiul 1"
  return /\b[2-9]\)\s|\b[2-9]\.\s|exerci[ț|t]iul\s+\d|problema\s+\d/i.test(query);
}

// ─── Haiku call ───────────────────────────────────────────────────────────────

const DECOMPOSE_SYSTEM = `Ești un parser de întrebări matematice. Analizezi dacă query-ul conține mai multe exerciții INDEPENDENTE.

REGULI CRITICE:
- Sub-puncte (a, b, c) ale ACELEIAȘI funcții/ecuații = UN exercițiu (isMulti: false)
  Ex: "Pentru f(x) = x² a) derivata b) monotonia" → UN exercițiu
- Exerciții complet diferite, numerotate cu 1), 2), 3) = MULTIPLE (isMulti: true)
  Ex: "1) Rezolvă x²-5x+6=0  2) Calculează ∫3x²dx" → două exerciții

Returnează STRICT JSON valid (fără text înainte sau după):
{
  "isMulti": boolean,
  "exercises": [
    {
      "id": 1,
      "text": "textul complet al exercițiului",
      "detectedType": "equation_quadratic" | "equation_linear" | "integral_simple" | "geometry_3d" | "limit" | "derivative" | "inequality" | "logarithm" | "complex_number" | "matrix" | "trigonometry" | "probability" | "combinatorics" | "sequence" | "function_analysis" | "other"
    }
  ]
}

Maxim 5 exerciții. Dacă mai multe, primele 5.`;

async function callHaikuDecomposer(query: string): Promise<DecomposedQuery> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: DECOMPOSE_SYSTEM,
    messages: [{ role: 'user', content: query }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  // Extract JSON robust (poate fi înconjurat de text)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Haiku response');

  const parsed = JSON.parse(jsonMatch[0]) as {
    isMulti: boolean;
    exercises: Array<{ id: number; text: string; detectedType: ExerciseType }>;
  };

  return {
    isMulti: parsed.isMulti,
    exercises: parsed.exercises.slice(0, 5),
    rawQuery: query,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Detectează și separă exercițiile din query.
 *
 * Comportament:
 * - Query scurt (<250 chars) sau fără markeri → single, fără Haiku
 * - Query lung cu markeri → Haiku call pentru separare
 * - Erori → fallback la single exercise
 *
 * Cost: $0 pentru 95%+ din queries, ~$0.0003 pentru cele multi-exercise.
 */
export async function decomposeQuery(query: string): Promise<DecomposedQuery> {
  const single: DecomposedQuery = {
    isMulti: false,
    exercises: [{ id: 1, text: query, detectedType: 'other' }],
    rawQuery: query,
  };

  // Fast-path: query scurt sau fără markeri tipici
  if (query.length < 250 || !hasMultiExerciseMarkers(query)) {
    return single;
  }

  // Haiku call pentru query-uri cu markeri de multi-exercise
  try {
    const result = await callHaikuDecomposer(query);
    console.log(`[decompose] isMulti=${result.isMulti}, exercises=${result.exercises.length}`);
    return result;
  } catch (err) {
    console.error('[decompose] Haiku failed, fallback to single:', err instanceof Error ? err.message : err);
    return single;
  }
}
