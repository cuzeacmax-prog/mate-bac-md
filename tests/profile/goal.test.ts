import { describe, it, expect } from 'vitest';
import {
  type Goal,
  GOALS,
  DEFAULT_GOAL,
  GOAL_OPTIONS,
  isGoal,
  resolveGoal,
  needsTarget,
  allowsBacLanguage,
  showsBacLens,
  defaultLens,
  mapHeadline,
  targetQuestion,
  goalShort,
  predictionLabel,
  officialSourceLabel,
  servableLabel,
} from '@/lib/profile/goal';

describe('ETAPA 82 — modelul de obiectiv (goal)', () => {
  it('cele trei obiective există, niciunul în plus', () => {
    expect([...GOALS].sort()).toEqual(['bac', 'explorare', 'note_clasa']);
  });

  it('default sigur = note_clasa, NU bac (A3: nu presupune BAC)', () => {
    expect(DEFAULT_GOAL).toBe('note_clasa');
  });

  it('isGoal validează corect', () => {
    expect(isGoal('bac')).toBe(true);
    expect(isGoal('note_clasa')).toBe(true);
    expect(isGoal('explorare')).toBe(true);
    expect(isGoal('BAC')).toBe(false);
    expect(isGoal(null)).toBe(false);
    expect(isGoal(undefined)).toBe(false);
    expect(isGoal(7)).toBe(false);
  });

  it('resolveGoal: valid → el însuși; orice altceva → default note_clasa', () => {
    expect(resolveGoal('bac')).toBe('bac');
    expect(resolveGoal('note_clasa')).toBe('note_clasa');
    expect(resolveGoal('explorare')).toBe('explorare');
    expect(resolveGoal(null)).toBe('note_clasa');
    expect(resolveGoal(undefined)).toBe('note_clasa');
    expect(resolveGoal('orice')).toBe('note_clasa');
  });

  it('needsTarget: bac & note_clasa cer notă-țintă; explorare nu', () => {
    expect(needsTarget('bac')).toBe(true);
    expect(needsTarget('note_clasa')).toBe(true);
    expect(needsTarget('explorare')).toBe(false);
  });

  it('limbajul de BAC și lentila BAC sunt active DOAR pentru goal=bac', () => {
    expect(allowsBacLanguage('bac')).toBe(true);
    expect(allowsBacLanguage('note_clasa')).toBe(false);
    expect(allowsBacLanguage('explorare')).toBe(false);
    expect(showsBacLens('bac')).toBe(true);
    expect(showsBacLens('note_clasa')).toBe(false);
    expect(showsBacLens('explorare')).toBe(false);
  });

  it('defaultLens: bac→bac; note_clasa cu țintă→tinta; fără țintă/explorare→null (hartă liberă)', () => {
    expect(defaultLens('bac', true)).toBe('bac');
    expect(defaultLens('bac', false)).toBe('bac');
    expect(defaultLens('note_clasa', true)).toBe('tinta');
    expect(defaultLens('note_clasa', false)).toBeNull();
    expect(defaultLens('explorare', true)).toBeNull();
    expect(defaultLens('explorare', false)).toBeNull();
  });

  // POARTĂ C: niciun limbaj de BAC la goal != bac — TOATE textele deterministe
  it('toate textele UI NU conțin "BAC" pentru note_clasa/explorare', () => {
    for (const goal of ['note_clasa', 'explorare'] as Goal[]) {
      for (const grade of [9, 10, 11, 12, null]) {
        expect(mapHeadline(goal, grade).toLowerCase()).not.toContain('bac');
      }
      expect(targetQuestion(goal).toLowerCase()).not.toContain('bac');
      expect(predictionLabel(goal).toLowerCase()).not.toContain('bac');
      expect(officialSourceLabel(goal).toLowerCase()).not.toContain('bac');
      for (const n of [0, 1, 5]) {
        expect(servableLabel(goal, n).toLowerCase()).not.toContain('bac');
      }
    }
  });

  it('textele pentru goal=bac VORBESC despre BAC (modul examen)', () => {
    expect(predictionLabel('bac').toLowerCase()).toContain('bac');
    expect(officialSourceLabel('bac').toLowerCase()).toContain('bac');
    expect(servableLabel('bac', 3).toLowerCase()).toContain('bac');
  });

  it('mapHeadline pentru bac vorbește despre BAC; pentru note_clasa despre clasă', () => {
    expect(mapHeadline('bac', 12).toLowerCase()).toContain('bac');
    expect(mapHeadline('note_clasa', 10)).toContain('10');
    expect(mapHeadline('note_clasa', 10).toLowerCase()).toContain('clas');
    expect(mapHeadline('explorare', null).length).toBeGreaterThan(0);
  });

  it('targetQuestion: explorare nu întreabă nimic (string gol)', () => {
    expect(targetQuestion('explorare')).toBe('');
    expect(targetQuestion('bac').toLowerCase()).toContain('bac');
    expect(targetQuestion('note_clasa').toLowerCase()).toContain('clas');
  });

  it('GOAL_OPTIONS = exact cele 3 obiective din spec, în ordine', () => {
    expect(GOAL_OPTIONS.map((o) => o.goal)).toEqual(['bac', 'note_clasa', 'explorare']);
    expect(GOAL_OPTIONS[0].label).toBe('Mă pregătesc de BAC');
    expect(GOAL_OPTIONS[1].label).toBe('Vreau note mai bune la clasă');
    expect(GOAL_OPTIONS[2].label).toBe('Explorez');
    for (const o of GOAL_OPTIONS) {
      expect(o.desc.length).toBeGreaterThan(0);
      expect(o.emoji.length).toBeGreaterThan(0);
    }
  });

  it('goalShort oferă etichetă scurtă pentru fiecare obiectiv', () => {
    for (const goal of GOALS) {
      const s = goalShort(goal);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.emoji.length).toBeGreaterThan(0);
    }
    // doar bac are limbaj de BAC în eticheta scurtă
    expect(goalShort('note_clasa').label.toLowerCase()).not.toContain('bac');
    expect(goalShort('explorare').label.toLowerCase()).not.toContain('bac');
  });
});
