/**
 * help.ts — ETAPA 70 FAZA D: chips-urile de ajutor sub exercițiul activ.
 *
 * [Nu știu cum să încep] [Dă-mi un indiciu (1/3→3/3)] [Arată-mi rezolvarea]
 * Fiecare cerere e un mesaj din cota existentă (/api/chat). Folosirea
 * ajutorului se PERSISTĂ (exercise_attempts, is_correct=null) — reușita
 * ulterioară pe același exercițiu în aceeași conversație primește pas EMA:
 *   fără ajutor → ×1; început/indiciu → ×0.5 (ÎNJUMĂTĂȚIT, convenit);
 *   rezolvarea arătată → ×0 (capitulare onestă: fără mastery).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { HELPED_WEIGHT } from '@/lib/mastery/evidence';

export type HelpKind = 'start' | 'hint' | 'solution';

/** instrucțiunea fermă pentru model — DOAR cât s-a cerut, nu rezolvarea întreagă */
export function buildHelpInstruction(kind: HelpKind, level: number, exerciseStatement: string): string {
  const base = `\n\n---\nCERERE DE AJUTOR pe exercițiul curent:\n${exerciseStatement}\n`;
  if (kind === 'start') {
    return (
      base +
      `Elevul nu știe cum să înceapă. Arată DOAR PRIMUL PAS (alegerea metodei sau prima transformare), în 1-2 propoziții + cel mult o formulă. NU continua rezolvarea — oprește-te și invită-l să facă pasul următor singur.`
    );
  }
  if (kind === 'solution') {
    return (
      base +
      `Elevul a cerut rezolvarea completă (capitulare onestă). Prezintă rezolvarea PAS CU PAS, fiecare pas scurt și numerotat, cu rezultatul final clar. La final, o propoziție de încurajare să încerce singur un exercițiu similar.`
    );
  }
  const focus =
    level <= 1
      ? 'DOAR DIRECȚIA: ce metodă/teoremă se aplică, fără formule și fără calcule.'
      : level === 2
        ? 'DOAR FORMULA necesară (una singură), fără să o aplici pe numere.'
        : 'DOAR PRIMUL CALCUL concret (înlocuirea în formulă), apoi oprește-te.';
  return base + `Indiciu progresiv nivel ${Math.min(level, 3)}/3. ${focus} Maxim 2 propoziții. NU dezvălui rezultatul final.`;
}

/** persistă folosirea ajutorului (urmă verificabilă, fără verdict) */
export async function recordHelpUsage(
  service: SupabaseClient,
  userId: string,
  conversationId: string,
  exerciseId: string,
  kind: HelpKind,
  level: number
): Promise<void> {
  const { error } = await service.from('exercise_attempts').insert({
    user_id: userId,
    exercise_id: exerciseId,
    is_correct: null,
    user_answer: `[ajutor:${kind}${kind === 'hint' ? ` ${Math.min(level, 3)}/3` : ''}]`,
    session_type: 'chat_ancorat',
    metadata: { conversation_id: conversationId, help: kind, help_level: level },
  });
  if (error) console.error('[help] usage insert failed:', error.message);
}

/** ce ajutoare s-au folosit pe exercițiul curent în conversația curentă */
export async function getHelpKindsUsed(
  service: SupabaseClient,
  userId: string,
  conversationId: string,
  exerciseId: string
): Promise<HelpKind[]> {
  const { data, error } = await service
    .from('exercise_attempts')
    .select('metadata')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .contains('metadata', { conversation_id: conversationId });
  if (error) {
    console.error('[help] kinds lookup failed:', error.message);
    return [];
  }
  const kinds = new Set<HelpKind>();
  for (const row of data ?? []) {
    const h = (row.metadata as { help?: string } | null)?.help;
    if (h === 'start' || h === 'hint' || h === 'solution') kinds.add(h);
  }
  return [...kinds];
}

/** ponderea pasului EMA la reușită, după ajutorul folosit */
export function helpWeight(kinds: HelpKind[]): number {
  if (kinds.includes('solution')) return 0; // capitulare onestă — fără mastery
  if (kinds.length > 0) return HELPED_WEIGHT; // orice alt chip → înjumătățit
  return 1;
}
