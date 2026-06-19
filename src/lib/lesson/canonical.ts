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
import { concreteExpr } from '@/lib/lesson/interactive';
import { statementVisible, leakClasses } from '@/lib/content/body-render';

/** Tot textul de PROZĂ vizibil al unui bloc (matematica trebuie să stea în $...$). */
function blockProse(b: LessonBlock): string {
  const parts: string[] = [];
  const v = (b as { variante?: Record<string, string> }).variante;
  if (v) parts.push(...Object.values(v));
  switch (b.tip) {
    case 'intro': parts.push(b.titlu, b.ideea_mare); break;
    case 'step': parts.push(b.titlu_scurt, b.corp); break;
    case 'formula': parts.push(b.explicatie); break;
    case 'example': parts.push(b.enunt, ...b.pasi.map((p) => p.text)); break;
    case 'quiz': parts.push(b.intrebare, ...Object.values(b.optiuni), b.indiciu ?? '', ...(b.rezolvare ?? [])); break;
    case 'recap': parts.push(...b.puncte); break;
    case 'reveal_figure': parts.push(...b.layers.map((l) => l.caption ?? ''), b.legenda ?? ''); break;
    case 'progressive_table': parts.push(b.titlu ?? '', ...b.coloane, ...b.randuri.flatMap((r) => r.cells)); break;
    case 'parameter_slider': parts.push(b.observe, b.legenda ?? ''); break;
    case 'try_step': parts.push(b.prompt, b.hint); break;
    default: { const lg = (b as { legenda?: string }).legenda; if (lg) parts.push(lg); }
  }
  return parts.filter(Boolean).join('\n');
}

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
  /**
   * ETAPA 77 B1 — MANDAT DE VIZUAL: conceptul ARE vizual disponibil
   * (figură de teorie / exercițiu cu figură / plotabil / manipulabil) →
   * lecția FĂRĂ niciun bloc vizual e respinsă la generare.
   */
  visualExpected?: boolean;
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
    // ── ETAPA 81: blocurile interactive trebuie să fie randabile/legitime ──
    if (b.tip === 'parameter_slider') {
      const mid = (b.range[0] + b.range[1]) / 2;
      const r = renderPlotSVG(concreteExpr(b.expr_template, b.param, mid), b.domain ?? [-5, 5]);
      if (!r.ok) { errors.push(`blocul ${i}: parameter_slider nu randează (${r.error})`); continue; }
    }
    if (b.tip === 'interactive_manipulative') {
      const r = renderManipulative(b.kind, b.params as Record<string, unknown>);
      if (!r.ok) { errors.push(`blocul ${i}: interactive_manipulative invalid: ${r.error}`); continue; }
    }
    if (b.tip === 'reveal_figure') {
      if (b.figure_kind === 'theory') {
        if (!b.theory_slug || !getTheoryFigure(b.theory_slug) || b.theory_slug !== ctx.theorySlug) {
          errors.push(`blocul ${i}: reveal_figure theory cu slug nepermis: ${b.theory_slug}`); continue;
        }
      } else if (!b.exercise_id || !ctx.servableExerciseIds.has(b.exercise_id)) {
        errors.push(`blocul ${i}: reveal_figure exercise în afara pool-ului: ${b.exercise_id}`); continue;
      }
    }
    // ETAPA 81: ZERO scurgeri de randare — matematica DOAR în $...$ (inclusiv în variante)
    const leaks = leakClasses(statementVisible(blockProse(b)));
    if (leaks.length > 0) {
      errors.push(`blocul ${i} (${b.tip}): notație matematică în text brut (scurgere: ${leaks.join(',')}) — pune-o în $...$`);
      continue;
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
  // ETAPA 77 B1: mandat de vizual — unde conceptul o permite, lecția TREBUIE
  // să arate, nu doar să povestească
  if (ctx.visualExpected) {
    // ETAPA 81: mandatul include blocurile INTERACTIVE (preferate față de cele statice)
    const visuals = count('figure') + count('plot') + count('manipulative') +
      count('parameter_slider') + count('progressive_table') + count('reveal_figure') + count('interactive_manipulative');
    if (visuals < 1) errors.push('MANDAT DE VIZUAL/INTERACTIV încălcat: concept cu vizual disponibil, lecție fără niciun bloc figure/plot/manipulative/slider/progressive_table/reveal_figure/interactive_manipulative');
  }

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
