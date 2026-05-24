/**
 * src/lib/rag/solution-methods.ts
 *
 * Helper pentru căutare semantică în `solution_methods` și construcție instrucțiuni
 * system prompt cu metodele BAC MD detectate.
 *
 * Design:
 *  - `findRelevantMethods(embedding, options)` — acceptă embedding pre-calculat
 *    (evită un al 2-lea apel Gemini când route-ul deja are embedding-ul din RAG)
 *  - `findRelevantMethodsByQuery(query, options)` — wrapper convenabil pentru
 *    endpoint-uri admin/test unde nu există embedding pre-calculat
 *  - `buildMethodInstruction` / `buildMultiMethodInstruction` — construiesc
 *    secțiunea de metodă pentru system prompt
 */

import { createServiceClient } from '@/lib/supabase/service';
import { generateEmbeddingForQuery } from '@/lib/embeddings/gemini';

// ─── Tipuri ────────────────────────────────────────────────────────────────────

export interface SolutionMethod {
  id: string;
  exercise_type: string;
  exercise_type_label: string;
  method_name: string;
  description: string | null;
  steps: Array<{
    step: number;
    title: string;
    content?: string;
    formula?: string;
  }>;
  notation_rules: Record<string, string>;
  examples: Array<{ problem: string; solution: string; answer: string }>;
  common_mistakes: Array<{ mistake: string; correction: string }>;
  required_tools: string[] | null;
  grade_level: number;
  topic: string;
  importance_score: number;
  similarity: number;
}

export interface FindMethodsOptions {
  /** Prag similaritate cosinus. Default: 0.55 */
  threshold?: number;
  /** Număr maxim de metode returnate. Default: 2 */
  limit?: number;
  /** Filtrare opțională după clasa (11 sau 12). */
  grade?: number | null;
  /** Filtrare opțională după temă (algebra, analysis, geometry…). */
  topic?: string | null;
}

// ─── Căutare semantică ─────────────────────────────────────────────────────────

/**
 * Caută metodele BAC MD cele mai relevante folosind un embedding pre-calculat.
 *
 * Preferă această funcție în route-uri unde embedding-ul este deja generat
 * (ex. `/api/chat`) — evită un apel Gemini suplimentar.
 *
 * Returnează [] în caz de eroare (non-blocking, backwards-compat).
 */
export async function findRelevantMethods(
  embedding: number[],
  options: FindMethodsOptions = {}
): Promise<SolutionMethod[]> {
  const {
    threshold = 0.45,
    limit = 2,
    grade = null,
    topic = null,
  } = options;

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc('match_solution_methods', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      filter_grade: grade,
      filter_topic: topic,
    });

    if (error) {
      // Tabela / funcția poate să nu existe — nu blochăm chat-ul
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('function')
      ) {
        return [];
      }
      console.warn('[solution-methods] match_solution_methods warning:', error.message);
      return [];
    }

    return (data ?? []) as SolutionMethod[];
  } catch (err) {
    console.error(
      '[solution-methods] findRelevantMethods exception:',
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * Variantă convenabilă care generează embedding-ul intern din query string.
 * Folosită de endpoint-uri admin/test unde nu există embedding pre-calculat.
 */
export async function findRelevantMethodsByQuery(
  query: string,
  options: FindMethodsOptions = {}
): Promise<SolutionMethod[]> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return [];
  try {
    const embedding = await generateEmbeddingForQuery(query);
    return findRelevantMethods(embedding, options);
  } catch (err) {
    console.error(
      '[solution-methods] findRelevantMethodsByQuery embedding failed:',
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ─── Construcție instrucțiuni system prompt ────────────────────────────────────

/**
 * Construiește secțiunea de instrucțiuni pentru system prompt dintr-o metodă BAC MD.
 * Rezultatul se injectează direct în system prompt înainte de apelul AI.
 */
export function buildMethodInstruction(method: SolutionMethod): string {
  // Etape obligatorii
  const stepsText = method.steps
    .map(s => {
      let line = `  ${s.step}. ${s.title}`;
      if (s.content) line += `: ${s.content}`;
      if (s.formula) line += ` [${s.formula}]`;
      return line;
    })
    .join('\n');

  // Notații BAC MD
  const notationLines = Object.entries(method.notation_rules ?? {});
  const notationText =
    notationLines.length > 0
      ? `\nREGULI NOTAȚIE BAC MD (obligatorii):\n${notationLines.map(([k, v]) => `  - ${k}: ${v}`).join('\n')}`
      : '';

  // Exemplu din DB
  const ex = method.examples?.[0];
  const exampleText = ex
    ? `\nExemplu obligatoriu de urmat:\n  Problemă: ${ex.problem}\n  Rezolvare: ${ex.solution}\n  Răspuns: ${ex.answer}`
    : '';

  // Greșeli frecvente
  const mistakes = method.common_mistakes ?? [];
  const mistakesText =
    mistakes.length > 0
      ? `\nGREȘELI DE EVITAT:\n${mistakes.map(m => `  ⚠️  ${m.mistake} → ${m.correction}`).join('\n')}`
      : '';

  const descLine = method.description ? `\nDescriere: ${method.description}` : '';

  return [
    '═══════════════════════════════════════════',
    'METODĂ DE REZOLVARE MD-SPECIFICĂ (OBLIGATORIE)',
    '═══════════════════════════════════════════',
    `Tipul exercițiului: ${method.exercise_type_label}`,
    `Clasa: ${method.grade_level} | Temă: ${method.topic}`,
    `Metoda: ${method.method_name}`,
    descLine,
    `\nETAPELE OBLIGATORII (urmează-le EXACT, în ordine):\n${stepsText}`,
    notationText,
    exampleText,
    mistakesText,
    '\nINSTRUCȚIUNI STRICTE:',
    '  • Aplică EXACT metoda de mai sus, pas cu pas',
    '  • Respectă notația MD: Δ (nu D), S = {...}, R: ..., DVA, u.p., u.c.',
    '  • Limba: română cu diacritice (ă, â, î, ș, ț)',
    '  • NU sări peste etape obligatorii',
    '  • Termină răspunsul cu "R: ..." sau "R/S: ..."',
    '═══════════════════════════════════════════',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Combină una sau mai multe metode într-o singură instrucțiune pentru system prompt.
 *
 * - 0 metode → '' (fallback la system prompt de bază)
 * - 1 metodă → `buildMethodInstruction(methods[0])`
 * - 2+ metode → prima e prioritară, a doua e opțional alternativă
 */
export function buildMultiMethodInstruction(methods: SolutionMethod[]): string {
  if (methods.length === 0) return '';
  if (methods.length === 1) return buildMethodInstruction(methods[0]);

  const primary = buildMethodInstruction(methods[0]);
  const altHeader = [
    '',
    '═══════════════════════════════════════════',
    'METODĂ ALTERNATIVĂ (FOLOSEȘTE DOAR DACĂ EXERCIȚIUL E CLAR DE ALT TIP)',
    '═══════════════════════════════════════════',
    `Tipul: ${methods[1].exercise_type_label}`,
    `Metoda: ${methods[1].method_name}`,
    '(aplică această metodă NUMAI dacă elevul cere explicit sau dacă tipul diferă)',
  ].join('\n');

  return `${primary}${altHeader}`;
}
