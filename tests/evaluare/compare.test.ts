import { describe, it, expect } from 'vitest';
import { compareAnswers, normalizeMathExpression } from '@/lib/evaluare/compare';

describe('normalizeMathExpression (ETAPA 63 P2)', () => {
  it('strip delimitatori + membrul drept al egalității', () => {
    expect(normalizeMathExpression('$E = 2$.')).toBe('2');
  });
  it('\\dfrac → fracție parsabilă', () => {
    expect(normalizeMathExpression('P = \\dfrac{135}{674}')).toBe('((135)/(674))');
  });
  it('unități eliminate', () => {
    expect(normalizeMathExpression('A = 1872\\,cm^2')).toBe('1872');
    expect(normalizeMathExpression('V = \\pi^2\\,(u.c)')).toBe('pi^2');
  });
  it('virgula zecimală românească', () => {
    expect(normalizeMathExpression('0,5')).toBe('0.5');
  });
});

describe('compareAnswers — numeric (Nivel A)', () => {
  it('exact egal → corect', () => {
    expect(compareAnswers('E = 2', '2')).toEqual({ comparable: true, correct: true });
  });
  it('echivalență fracție/zecimal → corect', () => {
    expect(compareAnswers('\\dfrac{1}{2}', '0,5')).toEqual({ comparable: true, correct: true });
  });
  it('greșit → incorect (comparabil)', () => {
    expect(compareAnswers('E = 2', '3')).toEqual({ comparable: true, correct: false });
  });
  it('cu unități: 1872 cm² ↔ 1872', () => {
    expect(compareAnswers('A = 1872\\,cm^2', '1872')).toEqual({ comparable: true, correct: true });
  });
  it('pi^2 ↔ aproximare zecimală în toleranță', () => {
    expect(compareAnswers('V = \\pi^2\\,(u.c)', '9.8696')).toEqual({ comparable: true, correct: true });
  });
  it('sqrt LaTeX ↔ valoare', () => {
    expect(compareAnswers('\\sqrt{2}', '1.4142')).toEqual({ comparable: true, correct: true });
  });
});

describe('compareAnswers — expresii simbolice', () => {
  it('252x^5 ↔ 252*x^5 → corect', () => {
    expect(compareAnswers('$T_6=252x^5$.', '252*x^5')).toEqual({ comparable: true, correct: true });
  });
  it('expresii diferite → incorect', () => {
    expect(compareAnswers('2x + 1', '2x - 1')).toEqual({ comparable: true, correct: false });
  });
  it('echivalență algebrică: (x+1)^2 ↔ x^2+2x+1', () => {
    expect(compareAnswers('(x+1)^2', 'x^2+2x+1')).toEqual({ comparable: true, correct: true });
  });
});

describe('compareAnswers — litere de variantă', () => {
  it('b ↔ B → corect', () => {
    expect(compareAnswers('b)', 'B')).toEqual({ comparable: true, correct: true });
  });
  it('b ↔ c → incorect', () => {
    expect(compareAnswers('b)', 'c')).toEqual({ comparable: true, correct: false });
  });
});

describe('compareAnswers — necomparabil → Nivel B', () => {
  it('răspuns oficial în proză → necomparabil', () => {
    expect(compareAnswers('Funcția $f$ este strict crescătoare pe $R$', 'crescatoare').comparable).toBe(false);
  });
  it('gol → necomparabil', () => {
    expect(compareAnswers('', '2').comparable).toBe(false);
  });
});
