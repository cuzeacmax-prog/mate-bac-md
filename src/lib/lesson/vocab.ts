/**
 * vocab.ts — ETAPA 81 FAZA C: VOCABULARUL ADAPTIV (determinist, zero LLM).
 *
 * C1 — nivelul din mastery: lecția se servește la un registru derivat din
 *   concept_mastery pe acel concept:
 *     mastery < 0.3        → 'comun'  (limbaj comun, fără jargon);
 *     0.3 ≤ mastery < 0.6  → 'punte'  (termen comun + „se numește X");
 *     mastery ≥ 0.6        → 'barem'  (registrul de barem/examen).
 *   Regula e DOCUMENTATĂ aici, pragurile sunt explicite.
 * C3 — comutatorul Simplu↔Riguros: override-ul manual bate nivelul din mastery;
 *   blocurile cu `variante` co-generate își schimbă proza FĂRĂ re-apel LLM.
 */
import type { VocabLevel } from './blocks';

/** Pragurile documentate (C1). Modificate aici, nu împrăștiate prin cod. */
export const VOCAB_THRESHOLDS = { comun: 0.3, barem: 0.6 } as const;

/** Registrul derivat din mastery (C1). */
export function masteryToRegister(mastery: number): VocabLevel {
  if (mastery >= VOCAB_THRESHOLDS.barem) return 'barem';
  if (mastery < VOCAB_THRESHOLDS.comun) return 'comun';
  return 'punte';
}

/** Eticheta umană a registrului (pentru comutatorul din player). */
export const REGISTER_LABEL: Record<VocabLevel, string> = {
  comun: 'Simplu',
  punte: 'Punte',
  barem: 'Riguros',
};

/**
 * Proza unui bloc la un registru dat: dacă blocul are `variante` co-generate
 * (C3), folosește varianta registrului; altfel textul de bază. Matematica NU se
 * atinge — doar proza. `base` = textul implicit al blocului.
 */
export function resolveProse(
  base: string,
  variante: Partial<Record<VocabLevel, string>> | undefined,
  level: VocabLevel
): string {
  if (!variante) return base;
  return variante[level]?.trim() || base;
}

/** Registrul activ: override-ul manual (comutator) bate nivelul din mastery (C3). */
export function activeRegister(masteryRegister: VocabLevel, override: VocabLevel | null): VocabLevel {
  return override ?? masteryRegister;
}
