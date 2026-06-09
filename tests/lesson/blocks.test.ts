import { describe, it, expect } from 'vitest';
import { countSentences, parseLessonBlock, stripQuizAnswer, type QuizBlock } from '@/lib/lesson/blocks';

describe('countSentences (ETAPA 67 A)', () => {
  it('numără propozițiile normale', () => {
    expect(countSentences('Prima. A doua! A treia?')).toBe(3);
  });
  it('ignoră zecimalele', () => {
    expect(countSentences('Rezultatul este 3.5 exact.')).toBe(1);
  });
  it('ignoră punctele din math inline', () => {
    expect(countSentences('Avem $f(x)=2.5x$. Gata.')).toBe(2);
  });
});

describe('LessonBlockSchema — limitele sunt ÎN schemă', () => {
  it('step valid trece', () => {
    const r = parseLessonBlock({
      tip: 'step',
      titlu_scurt: 'Discriminantul',
      corp: 'Calculăm $\\Delta = b^2-4ac$. Semnul lui decide câte soluții avem.',
      formula: '\\Delta = b^2 - 4ac',
    });
    expect(r.ok).toBe(true);
  });

  it('step cu corp de 5 propoziții = RESPINS (anti-enciclopedie)', () => {
    const r = parseLessonBlock({
      tip: 'step',
      titlu_scurt: 'Prea mult',
      corp: 'Una. Două. Trei. Patru. Cinci.',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('maxim 3');
  });

  it('intro cu ideea_mare de 3 propoziții = respins', () => {
    const r = parseLessonBlock({ tip: 'intro', titlu: 'T', ideea_mare: 'Una. Două. Trei.' });
    expect(r.ok).toBe(false);
  });

  it('example cu 5 pași = respins; 4 pași = acceptat', () => {
    const pas = { text: 'Aplicăm formula.' };
    expect(parseLessonBlock({ tip: 'example', enunt: 'E', pasi: [pas, pas, pas, pas, pas] }).ok).toBe(false);
    expect(parseLessonBlock({ tip: 'example', enunt: 'E', pasi: [pas, pas, pas, pas] }).ok).toBe(true);
  });

  it('quiz valid cu corecta; recap max 3 puncte', () => {
    const quiz = parseLessonBlock({
      tip: 'quiz',
      intrebare: 'Cât e $\\Delta$ pentru $x^2-5x+6=0$?',
      optiuni: { a: '1', b: '25', c: '-1', d: '49' },
      corecta: 'a',
    });
    expect(quiz.ok).toBe(true);
    expect(parseLessonBlock({ tip: 'recap', puncte: ['Unu.', 'Doi.', 'Trei.', 'Patru.'] }).ok).toBe(false);
  });

  it('tip necunoscut = respins cu eroare descriptivă', () => {
    const r = parseLessonBlock({ tip: 'eseu', text: 'bla' });
    expect(r.ok).toBe(false);
  });

  it('table: date structurate, nu markdown', () => {
    const r = parseLessonBlock({
      tip: 'table',
      coloane: ['$x$', '$f(x)$'],
      randuri: [['0', '1'], ['1', '2']],
    });
    expect(r.ok).toBe(true);
  });
});

describe('stripQuizAnswer — corecta NU pleacă la client', () => {
  it('elimină corecta și adaugă quiz_id', () => {
    const quiz: QuizBlock = {
      tip: 'quiz',
      intrebare: 'Q?',
      optiuni: { a: '1', b: '2', c: '3', d: '4' },
      corecta: 'b',
    };
    const client = stripQuizAnswer(quiz, 'q-1');
    expect('corecta' in client).toBe(false);
    expect((client as { quiz_id: string }).quiz_id).toBe('q-1');
  });
});
