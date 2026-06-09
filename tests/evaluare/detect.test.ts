import { describe, it, expect } from 'vitest';
import { detectAnswerAttempt } from '@/lib/evaluare/detect';

describe('detectAnswerAttempt (ETAPA 63 P1)', () => {
  it('număr simplu = încercare', () => {
    const d = detectAnswerAttempt('42');
    expect(d.isAttempt).toBe(true);
    expect(d.candidate).toBe('42');
  });

  it('expresie scurtă = încercare', () => {
    const d = detectAnswerAttempt('x = 3/2');
    expect(d.isAttempt).toBe(true);
    expect(d.candidate).toBe('x = 3/2');
  });

  it('"răspunsul este 7" → candidat 7', () => {
    const d = detectAnswerAttempt('răspunsul este 7');
    expect(d.isAttempt).toBe(true);
    expect(d.candidate).toBe('7');
  });

  it('literă de variantă = încercare', () => {
    const d = detectAnswerAttempt('b)');
    expect(d.isAttempt).toBe(true);
    expect(d.candidate).toBe('b');
  });

  it('întrebare NU e încercare', () => {
    expect(detectAnswerAttempt('de ce e 2?').isAttempt).toBe(false);
    expect(detectAnswerAttempt('cum se rezolvă exercițiul 3?').isAttempt).toBe(false);
  });

  it('"nu înțeleg" NU e încercare chiar cu cifre', () => {
    expect(detectAnswerAttempt('nu înțeleg pasul 2').isAttempt).toBe(false);
  });

  it('text fără matematică NU e încercare', () => {
    expect(detectAnswerAttempt('salut, hai să lucrăm').isAttempt).toBe(false);
  });

  it('mesaj lung cu pași → candidatul e ultima linie cu math', () => {
    const d = detectAnswerAttempt(
      'Am calculat primitiva functiei si am aplicat formula Leibniz-Newton ca sa obtin rezultatul final.\nF(1) - F(0) = 1\ndeci raspunsul e 1'
    );
    expect(d.isAttempt).toBe(true);
    expect(d.candidate).toBe('1');
  });
});
