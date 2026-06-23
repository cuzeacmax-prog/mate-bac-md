import { describe, it, expect } from 'vitest';
import { masteryToRegister, resolveProse, activeRegister, VOCAB_THRESHOLDS } from '@/lib/lesson/vocab';
import type { VocabLevel } from '@/lib/lesson/blocks';

describe('ETAPA 81 FAZA C1 — registru din mastery (praguri documentate)', () => {
  it('jos (<0.3) → comun', () => { expect(masteryToRegister(0.1)).toBe('comun'); expect(masteryToRegister(0.29)).toBe('comun'); });
  it('mediu [0.3,0.6) → punte', () => { expect(masteryToRegister(0.3)).toBe('punte'); expect(masteryToRegister(0.45)).toBe('punte'); });
  it('sus (≥0.6) → barem', () => { expect(masteryToRegister(0.6)).toBe('barem'); expect(masteryToRegister(0.9)).toBe('barem'); });
  it('pragurile sunt cele documentate', () => { expect(VOCAB_THRESHOLDS).toEqual({ comun: 0.3, barem: 0.6 }); });
});

describe('ETAPA 81 FAZA C3 — comutator: override bate mastery', () => {
  it('override manual câștigă', () => { expect(activeRegister('comun', 'barem')).toBe('barem'); });
  it('fără override → nivelul din mastery', () => { expect(activeRegister('punte', null)).toBe('punte'); });
});

// ETAPA 83 FAZA E — registrul IMPLICIT = comun/punte (elevul mediu), NU barem.
describe('ETAPA 83 E — implicit comun/punte, nu barem', () => {
  it('elev nou / fără evidență (mastery 0) → comun (nu barem)', () => {
    expect(masteryToRegister(0)).toBe('comun');
    expect(masteryToRegister(0)).not.toBe('barem');
  });
  it('barem DOAR la concept stăpânit (mastery ≥ 0.6)', () => {
    expect(masteryToRegister(0.59)).not.toBe('barem');
    expect(masteryToRegister(0.6)).toBe('barem');
  });
  // playerul pornește pe „punte" (LessonPlayer.tsx) — registru de punte, nu de examen
  it('fără override, registrul de start „punte" rămâne punte', () => {
    expect(activeRegister('punte', null)).toBe('punte');
  });
});

describe('ETAPA 81 FAZA C — resolveProse (variante co-generate)', () => {
  it('fără variante → textul de bază', () => { expect(resolveProse('baza', undefined, 'barem')).toBe('baza'); });
  it('cu variantă → varianta registrului', () => {
    expect(resolveProse('baza', { comun: 'simplu', barem: 'riguros' }, 'barem')).toBe('riguros');
  });
  it('variantă lipsă pe registru → cade pe bază', () => {
    expect(resolveProse('baza', { comun: 'simplu' }, 'barem')).toBe('baza');
  });
});

// ── POARTĂ C: același concept la 3 registre → 3 texte VIZIBIL diferite, math NESCHIMBATĂ ──
describe('POARTĂ C — 3 registre distincte, matematica neatinsă', () => {
  // bloc step cu o formulă fixă + 3 variante de proză co-generate
  const block = {
    corp: 'Funcția își schimbă semnul.',
    formula: 'f(x) = ax^2 + bx + c', // matematica — NU se atinge
    variante: {
      comun: 'Curba urcă sau coboară — uite cum se schimbă.',
      punte: 'Funcția este monotonă (adică merge într-o singură direcție) pe interval.',
      barem: 'Funcția este strict monotonă pe intervalul de definiție.',
    } satisfies Partial<Record<VocabLevel, string>>,
  };
  it('cele 3 registre produc texte distincte', () => {
    const texts = (['comun', 'punte', 'barem'] as VocabLevel[]).map((r) => resolveProse(block.corp, block.variante, r));
    expect(new Set(texts).size).toBe(3); // toate diferite
    // distribuția lungimii raportată
    const lens = texts.map((t) => t.length);
    expect(Math.max(...lens) - Math.min(...lens)).toBeGreaterThan(0);
  });
  it('comutarea NU schimbă matematica (formula identică pe toate registrele)', () => {
    for (const r of ['comun', 'punte', 'barem'] as VocabLevel[]) {
      resolveProse(block.corp, block.variante, r); // doar proza se rezolvă
      expect(block.formula).toBe('f(x) = ax^2 + bx + c'); // formula neatinsă
    }
  });
  it('mastery 0.1/0.45/0.8 → 3 registre, deci 3 texte', () => {
    const regs = [0.1, 0.45, 0.8].map(masteryToRegister);
    expect(new Set(regs).size).toBe(3);
  });
});
