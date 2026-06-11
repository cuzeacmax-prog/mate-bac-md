/**
 * canonical.ts — ETAPA 75 FAZA B: lecțiile CANONICE.
 *
 * R5 ÎNTĂRIT: lecția canonică se construiește EXCLUSIV din teoria grafului +
 * exerciții servibile + figurile/manipulativele existente. POARTA
 * ANTI-FABRICAȚIE de aici e folosită ȘI de generator (înainte de persistare),
 * ȘI de scriptul de validare (re-verifică tot ce e în DB împotriva pool-ului
 * servibil) — o lecție cu referință inexistentă NU se servește.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseLessonBlock, type LessonBlock } from '@/lib/lesson/blocks';
import { getTheoryFigure } from '@/lib/lesson/theory-figures/registry';
import { renderPlotSVG } from '@/lib/lesson/plot';
import { renderManipulative } from '@/lib/lesson/manipulatives';

export interface CanonicalLesson {
  id: string;
  concept_id: string;
  version: number;
  blocks: LessonBlock[];
  surse: { exercise_ids: string[]; theory_figure: string | null };
  model: string;
  status: 'generat' | 'aprobat-profesor';
  observatii: string | null;
  generated_at: string;
}

export interface CanonicalValidationContext {
  /** id-urile exercițiilor SERVIBILE date modelului — singurele referibile */
  servableExerciseIds: Set<string>;
  /** slug-ul figurii de teorie anunțate (null = nu există în registru) */
  theorySlug: string | null;
}

/**
 * POARTA ANTI-FABRICAȚIE + structura cerută (B2):
 * intro → ... → exemplu rezolvat → 2-3 quiz-uri → recap;
 * fiecare exercițiu/figură referită TREBUIE să existe în pool-ul servibil;
 * plot/manipulative trebuie să randeze determinist.
 */
export function validateCanonicalBlocks(
  rawBlocks: unknown[],
  ctx: CanonicalValidationContext
): { ok: true; blocks: LessonBlock[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const blocks: LessonBlock[] = [];
  for (const [i, raw] of rawBlocks.entries()) {
    const parsed = parseLessonBlock(raw);
    if (!parsed.ok) {
      errors.push(`blocul ${i}: respins de validator: ${parsed.error}`);
      continue;
    }
    const b = parsed.block;
    // referințele: DOAR ce există (anti-fabricație)
    if (b.tip === 'figure') {
      if (b.kind === 'theory') {
        if (!b.theory_slug || !getTheoryFigure(b.theory_slug) || b.theory_slug !== ctx.theorySlug) {
          errors.push(`blocul ${i}: figure theory cu slug nepermis/inexistent: ${b.theory_slug}`);
          continue;
        }
      } else if (!b.exercise_id || !ctx.servableExerciseIds.has(b.exercise_id)) {
        errors.push(`blocul ${i}: figure exercise cu id în afara pool-ului servibil: ${b.exercise_id}`);
        continue;
      }
    }
    if (b.tip === 'plot') {
      const r = renderPlotSVG(b.expr, b.domain, b.puncte_marcate);
      if (!r.ok) {
        errors.push(`blocul ${i}: plot nu randează: ${r.error}`);
        continue;
      }
    }
    if (b.tip === 'manipulative') {
      const r = renderManipulative(b.kind, b.params);
      if (!r.ok) {
        errors.push(`blocul ${i}: manipulative nu randează: ${r.error}`);
        continue;
      }
    }
    blocks.push(b);
  }

  // structura canonică (B2)
  const count = (tip: LessonBlock['tip']) => blocks.filter((b) => b.tip === tip).length;
  if (count('intro') !== 1) errors.push(`intro: ${count('intro')} (cerut exact 1)`);
  if (count('recap') < 1) errors.push('recap lipsă');
  if (count('example') < 1) errors.push('exemplu rezolvat lipsă (cerut ≥1, din exercițiile servibile)');
  const quizzes = count('quiz');
  if (quizzes < 2 || quizzes > 3) errors.push(`quiz-uri: ${quizzes} (cerut 2-3)`);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, blocks };
}

/** ultima versiune canonică a unui concept (după slug), pentru SERVIRE */
export async function getCanonicalLesson(
  service: SupabaseClient,
  conceptId: string
): Promise<CanonicalLesson | null> {
  const { data, error } = await service
    .from('lesson_canonical')
    .select('id, concept_id, version, blocks, surse, model, status, observatii, generated_at')
    .eq('concept_id', conceptId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[lesson/canonical] fetch failed:', error.message);
    return null;
  }
  return (data as CanonicalLesson | null) ?? null;
}
