/**
 * ETAPA 82 — Modelul de OBIECTIV al elevului.
 *
 * Cerința structurală a ownerului: "elevul vede DOAR ce-i relevant clasei lui;
 * nu toți dau BAC". Până acum singurul semnal de intenție era `target_bac_score`
 * (un număr 7–10), care presupunea că oricine ținteșe BAC-ul. Aici introducem
 * obiectivul ca dimensiune separată, deterministă, fără LLM.
 *
 * BAC-ul devine MOD, nu cadru: limbajul și lentila de examen apar DOAR pentru
 * goal='bac'. Pentru note_clasa/explorare — zero limbaj de BAC (POARTĂ C).
 */

export type Goal = 'bac' | 'note_clasa' | 'explorare';

export const GOALS: readonly Goal[] = ['bac', 'note_clasa', 'explorare'] as const;

/**
 * Default sigur (A3): un elev fără obiectiv setat NU este presupus candidat la
 * BAC. note_clasa este cea mai blândă presupunere — fără anxietate de examen.
 */
export const DEFAULT_GOAL: Goal = 'note_clasa';

export function isGoal(v: unknown): v is Goal {
  return v === 'bac' || v === 'note_clasa' || v === 'explorare';
}

/** Rezolvă obiectivul dintr-un profil; null/necunoscut → DEFAULT_GOAL. */
export function resolveGoal(raw: unknown): Goal {
  return isGoal(raw) ? raw : DEFAULT_GOAL;
}

/** bac & note_clasa au o notă-țintă; explorare nu. */
export function needsTarget(goal: Goal): boolean {
  return goal !== 'explorare';
}

/** Limbajul de examen (cuvântul "BAC") e permis DOAR pentru goal=bac. */
export function allowsBacLanguage(goal: Goal): boolean {
  return goal === 'bac';
}

/** Lentila "BAC" de pe hartă apare doar pentru goal=bac. */
export function showsBacLens(goal: Goal): boolean {
  return goal === 'bac';
}

/**
 * Lentila implicită a hărții, subordonată obiectivului (C1):
 *  - bac        → 'bac'   (evidențiază traseul spre examen)
 *  - note_clasa → 'tinta' dacă are notă-țintă, altfel null (hartă liberă)
 *  - explorare  → null    (fără presiune de traseu)
 * null = fără dimming, toate conceptele clasei egal vizibile.
 */
export function defaultLens(goal: Goal, hasTarget: boolean): 'bac' | 'tinta' | null {
  if (goal === 'bac') return 'bac';
  if (goal === 'note_clasa' && hasTarget) return 'tinta';
  return null;
}

/** Antetul hărții / pagina "azi" — determinist, ZERO limbaj de BAC la non-bac. */
export function mapHeadline(goal: Goal, grade: number | null): string {
  switch (goal) {
    case 'bac':
      return 'Drumul tău spre BAC';
    case 'note_clasa':
      return grade ? `Stăpânește clasa a ${grade}-a` : 'Stăpânește materia clasei tale';
    case 'explorare':
      return 'Explorează matematica';
  }
}

/** Întrebarea de notă-țintă, reformulată după obiectiv. Explorare → '' (nu se întreabă). */
export function targetQuestion(goal: Goal): string {
  switch (goal) {
    case 'bac':
      return 'Ce notă vrei să iei la BAC Matematică?';
    case 'note_clasa':
      return 'Ce notă vrei să iei la clasă?';
    case 'explorare':
      return '';
  }
}

/** Eticheta scurtă a obiectivului (setări, confirmare, badge-uri). */
export function goalShort(goal: Goal): { label: string; emoji: string } {
  switch (goal) {
    case 'bac':
      return { label: 'Pregătire BAC', emoji: '🎓' };
    case 'note_clasa':
      return { label: 'Note mai bune la clasă', emoji: '📈' };
    case 'explorare':
      return { label: 'Explorare liberă', emoji: '🧭' };
  }
}

/**
 * Opțiunile de obiectiv — sursa unică pentru onboarding, confirmare și setări.
 * Etichetele sunt EXACT cele cerute de owner în spec (A2).
 */
export const GOAL_OPTIONS: readonly {
  goal: Goal;
  label: string;
  desc: string;
  emoji: string;
}[] = [
  { goal: 'bac', label: 'Mă pregătesc de BAC', desc: 'Vreau să trec examenul cu o notă bună', emoji: '🎓' },
  { goal: 'note_clasa', label: 'Vreau note mai bune la clasă', desc: 'Mă concentrez pe materia din clasă', emoji: '📈' },
  { goal: 'explorare', label: 'Explorez', desc: 'Învăț din curiozitate, în ritmul meu', emoji: '🧭' },
] as const;
