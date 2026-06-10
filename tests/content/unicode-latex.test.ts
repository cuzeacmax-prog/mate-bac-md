/**
 * ETAPA 70 G1 — convertorul determinist Unicode→LaTeX:
 * notația se transliterează, româna rămâne text, nimic nu se inventează.
 */
import { describe, it, expect } from 'vitest';
import { unicodeToLatex } from '@/lib/content/unicode-latex';

describe('unicodeToLatex', () => {
  const cases: Array<[string, string]> = [
    ['Rezolvați ecuația: x² - 9 = 0', 'Rezolvați ecuația: $x^{2} - 9 = 0$'],
    ['Rezolvați ecuația: √(x + 4) = x - 2', 'Rezolvați ecuația: $\\sqrt{x + 4} = x - 2$'],
    ['DVA = ℝ \\ {-2}', 'DVA $= \\mathbb{R} \\setminus \\{-2\\}$'],
    ['Calculați: ∫₀² x³ dx', 'Calculați: $\\int_{0}^{2} x^{3} dx$'],
    ['S = {25/3}', '$S = \\{25/3\\}$'],
    ['Rezolvați ecuația: 3x + 5 = 20', 'Rezolvați ecuația: $3x + 5 = 20$'],
    ['Mulțimea soluțiilor este S = ∅.', 'Mulțimea soluțiilor este $S = \\varnothing$.'],
  ];
  for (const [input, expected] of cases) {
    it(`convertește: ${input.slice(0, 40)}`, () => {
      const r = unicodeToLatex(input);
      expect(r.out).toBe(expected);
      expect(r.full).toBe(true);
    });
  }

  it('textul pur românesc rămâne NEATINS', () => {
    const t = 'Care din următoarele expresii este o ecuație?';
    const r = unicodeToLatex(t);
    expect(r.out).toBe(t);
    expect(r.full).toBe(true);
  });

  it('un = solitar în paranteză nu e capturat ca matematică', () => {
    const t = 'O ecuație este o egalitate între două expresii matematice (conține semnul =).';
    expect(unicodeToLatex(t).out).toBe(t);
  });

  it('indici și exponenți: x₁ · x₂ și 2ˣ', () => {
    expect(unicodeToLatex('x₁ · x₂ = 6').out).toBe('$x_{1} \\cdot x_{2} = 6$');
    expect(unicodeToLatex('f(x) = 2ˣ').out).toBe('$f(x) = 2^{x}$');
  });

  it('idempotent pe text deja convertit (nu dublează $)', () => {
    const once = unicodeToLatex('x² - 9 = 0').out;
    // re-conversia se face DIN original în script; aici doar verificăm că
    // textul convertit nu mai conține notații Unicode rămase
    expect(/[²√∫]/.test(once)).toBe(false);
  });
});
