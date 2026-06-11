/**
 * ETAPA 74 B2/B3 — testele claselor dovedite de randare-audit:
 *  - \text{...} cu diacritice NU mai face formula suspectă;
 *  - mediile array/tabular lungi se segmentează ca MATH (nu cad pe text brut);
 *  - mediile \begin{...} fără delimitatori se recunosc;
 *  - tabular → array pentru KaTeX;
 *  - detectorul de exerciții ne-autonome (fraze + structură).
 */
import { describe, it, expect } from 'vitest';
import { segmentDelimitedMath, isSuspectMath } from '@/lib/content-math';
import { tabularToArray } from '@/lib/content/katex-macros';
import { selfContainedIssues } from '@/lib/content/self-contained';

describe('isSuspectMath (ETAPA 74 B2 — fără false positives de clasă)', () => {
  it('diacriticele din \\text{...} sunt legitime', () => {
    expect(isSuspectMath('\\int_a^b f(x)dx \\geq 0 \\quad \\text{dacă } f(x) \\geq 0')).toBe(false);
  });
  it('diacriticele în AFARA \\text{} rămân suspecte (proză înghițită)', () => {
    expect(isSuspectMath('x = 3 și înălțimea este mare')).toBe(true);
  });
  it('mediul array lung NU e suspect (structură math)', () => {
    const arr = `\\begin{array}{|c|c|}\\hline L & l \\\\\\hline ${'1 & 2 \\\\\\hline '.repeat(20)}\\end{array}`;
    expect(arr.length).toBeGreaterThan(200);
    expect(isSuspectMath(arr)).toBe(false);
  });
  it('proza lungă fără comenzi rămâne suspectă', () => {
    expect(isSuspectMath('a'.repeat(100) + ' cuvinte multe fara comenzi latex deloc '.repeat(8))).toBe(true);
  });
});

describe('segmentDelimitedMath (ETAPA 74 B2 — medii și display)', () => {
  it('\\[\\begin{array}...\\]: enunțul-tabel din culegere se randează ca MATH', () => {
    const text = 'Completați tabelul:\n\n\\[\n\\begin{array}{|c|c|}\n\\hline\n & L \\\\\n\\hline\n\\text{a} & 28 \\\\\n\\hline\n\\end{array}\n\\]';
    const segs = segmentDelimitedMath(text);
    const math = segs.find((s) => s.type === 'math');
    expect(math).toBeDefined();
    expect(math!.display).toBe(true);
    expect(math!.value).toContain('\\begin{array}');
  });
  it('mediul \\begin{array} FĂRĂ delimitatori devine math display', () => {
    const segs = segmentDelimitedMath('Tabelul: \\begin{array}{cc} a & b \\\\ c & d \\end{array} de completat.');
    const math = segs.find((s) => s.type === 'math');
    expect(math).toBeDefined();
    expect(math!.display).toBe(true);
    expect(math!.value).toMatch(/^\\begin\{array\}/);
  });
  it('display math cu \\text{dacă} (diacritice) se randează, nu cade pe text', () => {
    const segs = segmentDelimitedMath('$$\\int_a^b f \\geq 0 \\text{ dacă } f \\geq 0$$');
    expect(segs.filter((s) => s.type === 'math')).toHaveLength(1);
  });
});

describe('tabularToArray', () => {
  it('traduce tabular în array (KaTeX nu știe tabular)', () => {
    expect(tabularToArray('\\begin{tabular}{|c|} x \\end{tabular}')).toBe('\\begin{array}{|c|} x \\end{array}');
  });
});

describe('selfContainedIssues (ETAPA 74 B3)', () => {
  it('„folosind notațiile de mai sus" fără definire = ne-autonom', () => {
    expect(selfContainedIssues('Folosind notațiile de mai sus, calculați $V$.', false)).toContain('notatii-externe');
  });
  it('enunțul care ÎȘI definește notațiile e autonom', () => {
    expect(selfContainedIssues('Am notat cu $L$ latura. Folosind notațiile de mai sus, calculați $V$.', false)).toEqual([]);
  });
  it('„în tabelul de mai jos" CU tabel inclus (array) e autonom', () => {
    const st = 'În tabelul de mai jos am notat cu $L$ latura. \\[\\begin{array}{|c|}\\hline L \\\\\\hline\\end{array}\\]';
    expect(selfContainedIssues(st, false)).toEqual([]);
  });
  it('„completați tabelul" fără tabel = ne-autonom', () => {
    expect(selfContainedIssues('Completați tabelul cu valorile cerute.', false)).toContain('tabel-absent');
  });
  it('„tabelul integralelor nedefinite" e referință canonică, NU context absent', () => {
    expect(selfContainedIssues('Folosind formulele din tabelul integralelor nedefinite, calculați primitivele.', false)).toEqual([]);
  });
  it('„din figura alăturată" fără figură servibilă = ne-autonom', () => {
    expect(selfContainedIssues('Din figura alăturată, aflați unghiul.', false)).toContain('figura-absenta');
  });
  it('„din figura alăturată" CU figură servibilă e autonom', () => {
    expect(selfContainedIssues('Din figura alăturată, aflați unghiul.', true)).toEqual([]);
  });
  it('referința la exercițiul precedent = ne-autonom', () => {
    expect(selfContainedIssues('Folosind rezultatul de la exercițiul precedent, calculați suma.', false)).toContain('referinta-externa');
  });
});
