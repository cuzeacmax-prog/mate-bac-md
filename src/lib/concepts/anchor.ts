/**
 * anchor.ts — ETAPA 60 PAS 5 + ETAPA 64: ancorarea chat-ului într-un concept din graf.
 * Teoria vine din concepts.body (max ~2000 chars); exercițiile din DOUĂ niveluri
 * de încredere servibile (decizie aprobată ETAPA 64):
 *   'verificat'      — verificare CAS pass (exercise_verification)
 *   'sursa-oficiala' — enunț + răspuns oficial din culegere (link 'strict-bijectiv')
 * Ordinea servirii: întâi 'verificat', apoi 'sursa-oficiala' (etichetat vizibil).
 * Tot extragere — nimic generat.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type ExerciseTier = 'verificat' | 'sursa-oficiala';

export interface AnchorExercise {
  id: string;
  statement: string;
  module: string | null;
  /** id-ul figurii acceptate legate de exercițiu (ETAPA 60 PAS 6), dacă există */
  has_figure: boolean;
  /** nivelul de încredere al exercițiului (ETAPA 64) */
  tier: ExerciseTier;
  /** răspunsul oficial din culegere (doar pentru tier='sursa-oficiala') — pentru profesor, nu afișat direct */
  official_answer: string | null;
}

export interface ConceptAnchor {
  id: string;
  slug: string;
  name: string;
  grade_level: number | null;
  /** teoria din graf, tăiată la maxTheoryChars */
  theory: string;
  exercises: AnchorExercise[];
}

const MAX_THEORY_CHARS = 2000;

export async function getConceptAnchor(
  service: SupabaseClient,
  slug: string,
  maxExercises = 2
): Promise<ConceptAnchor | null> {
  const { data: concept, error } = await service
    .from('concepts')
    .select('id, slug, name, grade_level, body')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !concept) {
    if (error) console.error('[concepts/anchor] lookup failed:', error.message);
    return null;
  }

  // exerciții legate de concept, în ordinea rank-ului
  const { data: links, error: linkErr } = await service
    .from('exercise_concept_link')
    .select('exercise_id, rank, similarity')
    .eq('concept_id', concept.id)
    .order('rank', { ascending: true })
    .limit(200); // ETAPA 64: un concept poate avea >100 linkuri; fereastra mică
                 // ascundea exercițiile sursă-oficială cu figură de la rank 2-3
  if (linkErr) console.error('[concepts/anchor] links failed:', linkErr.message);

  const exerciseIds = [...new Set((links ?? []).map((l) => l.exercise_id as string))];
  const exercises: AnchorExercise[] = [];
  if (exerciseIds.length > 0) {
    // nivelurile servibile (ETAPA 64): verificat > sursa-oficiala
    const { data: servable } = await service
      .from('exercise_servable')
      .select('exercise_id, tier')
      .in('exercise_id', exerciseIds);
    const tierById = new Map((servable ?? []).map((s) => [s.exercise_id as string, s.tier as ExerciseTier]));

    // figurile acceptate legate (coloana figura_autor.exercise_id, PAS 6) —
    // citite ÎNAINTE de alegere: în cadrul aceluiași tier, exercițiile cu
    // figură au prioritate (figurile sunt rare și trebuie să se aprindă).
    const servableIds = exerciseIds.filter((id) => tierById.has(id));
    const { data: figs } = servableIds.length
      ? await service
          .from('figura_autor')
          .select('exercise_id')
          .in('exercise_id', servableIds)
          .in('status', ['approved', 'auto-acceptat'])
      : { data: [] as Array<{ exercise_id: string }> };
    const figSet = new Set((figs ?? []).map((f) => f.exercise_id as string));

    // întâi 'verificat' (în ordinea rank), apoi 'sursa-oficiala'; cu figură înainte
    const byFigureFirst = (ids: string[]) => [
      ...ids.filter((id) => figSet.has(id)),
      ...ids.filter((id) => !figSet.has(id)),
    ];
    const verifiedIds = byFigureFirst(servableIds.filter((id) => tierById.get(id) === 'verificat'));
    const officialIds = byFigureFirst(servableIds.filter((id) => tierById.get(id) === 'sursa-oficiala'));
    const chosen = [...verifiedIds, ...officialIds].slice(0, maxExercises);

    if (chosen.length > 0) {
      const [{ data: exRows }, { data: answers }] = await Promise.all([
        service.from('exercise_raw').select('id, statement, module').in('id', chosen),
        // răspunsul oficial pentru tier='sursa-oficiala' (link neambiguu)
        service
          .from('exercise_answer_link')
          .select('exercise_id, exercise_answers(answer_text)')
          .in('exercise_id', chosen)
          .eq('match_confidence', 'strict-bijectiv'),
      ]);
      const answerById = new Map(
        (answers ?? []).map((a) => {
          const ans = a.exercise_answers as unknown as { answer_text: string } | { answer_text: string }[] | null;
          const row = Array.isArray(ans) ? ans[0] : ans;
          return [a.exercise_id as string, row?.answer_text ?? null];
        })
      );
      for (const id of chosen) {
        const row = (exRows ?? []).find((r) => r.id === id);
        if (row) {
          exercises.push({
            id: row.id as string,
            statement: row.statement as string,
            module: (row.module as string | null) ?? null,
            has_figure: figSet.has(id),
            tier: tierById.get(id) ?? 'verificat',
            official_answer: answerById.get(id) ?? null,
          });
        }
      }
    }
  }

  return {
    id: concept.id as string,
    slug: concept.slug as string,
    name: concept.name as string,
    grade_level: (concept.grade_level as number | null) ?? null,
    theory: ((concept.body as string | null) ?? '').slice(0, MAX_THEORY_CHARS),
    exercises,
  };
}

function tierLabel(e: AnchorExercise): string {
  return e.tier === 'verificat' ? 'verificat' : 'din culegerea oficială BAC';
}

/** Fragmentul de system prompt pentru un chat ancorat în concept. */
export function buildConceptSystemAddendum(anchor: ConceptAnchor): string {
  const exercisesBlock = anchor.exercises.length
    ? anchor.exercises
        .map((e, i) => {
          const answerLine = e.official_answer
            ? `\nRăspunsul oficial din culegere (NU-l dezvălui elevului până nu încearcă): ${e.official_answer}`
            : '';
          return `Exercițiul ${i + 1} (${tierLabel(e)}, ${e.module ?? 'modul necunoscut'}):\n${e.statement}${answerLine}`;
        })
        .join('\n\n')
    : '(nu există exerciții servibile pentru acest concept — lucrează doar pe teorie)';
  return `
---
SESIUNE ANCORATĂ ÎN CONCEPT (din graful programei):
Concept: ${anchor.name} (clasa ${anchor.grade_level ?? '?'}, slug: ${anchor.slug})
Teorie de referință (folosește-o ca sursă de adevăr, nu o contrazice):
${anchor.theory}

Exerciții de lucru (extrase din culegere — propune-le în această ordine):
${exercisesBlock}

Reguli pentru această sesiune: rămâi pe acest concept; dacă elevul deviază, readu-l blând la subiect.`;
}

/** Primul mesaj al asistentului (template determinist, ZERO LLM). */
export function buildIntroMessage(anchor: ConceptAnchor): string {
  const theoryExcerpt = anchor.theory.slice(0, 600);
  const first = anchor.exercises[0];
  const intro = `**${anchor.name}** (clasa ${anchor.grade_level ?? '?'})

${theoryExcerpt}${anchor.theory.length > 600 ? '…' : ''}`;
  if (!first) {
    return `${intro}

Pentru acest concept nu am încă exerciții servibile în bibliotecă — putem lucra pe teorie: pune-mi orice întrebare despre el.`;
  }
  const figura = first.has_figure ? `\n\n![Figura exercițiului](/api/figura/${first.id})` : '';
  const sursa = first.tier === 'verificat' ? 'verificat din culegere' : 'din culegerea oficială BAC';
  return `${intro}

Hai să exersăm. Primul exercițiu (${sursa}):

> ${first.statement}${figura}

Încearcă să-l rezolvi și scrie-mi pașii tăi — te corectez pe parcurs.`;
}
