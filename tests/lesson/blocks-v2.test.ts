import { describe, it, expect } from 'vitest';
import { parseLessonBlock, stripTryStepAnswer, type TryStepBlock } from '@/lib/lesson/blocks';

const ok = (raw: unknown) => { const r = parseLessonBlock(raw); if (!r.ok) throw new Error(r.error); return r.block; };
const bad = (raw: unknown) => { const r = parseLessonBlock(raw); return r.ok ? null : r.error; };

describe('ETAPA 81 FAZA A — reveal_figure', () => {
  it('valid (theory) cu straturi', () => {
    const b = ok({ tip: 'reveal_figure', figure_kind: 'theory', theory_slug: 'g10-functie', layers: [{ step_index: 0, elements: ['axa'], caption: 'Axa.' }] });
    expect(b.tip).toBe('reveal_figure');
  });
  it('exercise fără exercise_id → respins', () => { expect(bad({ tip: 'reveal_figure', figure_kind: 'exercise', layers: [{ step_index: 0, elements: ['a'] }] })).toMatch(/exercise_id/); });
  it('layer fără elemente → respins', () => { expect(bad({ tip: 'reveal_figure', figure_kind: 'theory', theory_slug: 'g10-functie', layers: [{ step_index: 0, elements: [] }] })).toBeTruthy(); });
});

describe('ETAPA 81 FAZA A — progressive_table', () => {
  it('valid', () => {
    const b = ok({ tip: 'progressive_table', coloane: ['x', 'sign'], randuri: [{ cells: ['1', '+'], reveal_at_step: 0, highlight_cell: 1 }] });
    expect(b.tip).toBe('progressive_table');
  });
  it('o singură coloană → respins (min 2)', () => { expect(bad({ tip: 'progressive_table', coloane: ['x'], randuri: [{ cells: ['1'], reveal_at_step: 0 }] })).toBeTruthy(); });
});

describe('ETAPA 81 FAZA A — interactive_manipulative', () => {
  it('valid (zaruri, params JSON string)', () => {
    const b = ok({ tip: 'interactive_manipulative', kind: 'zaruri', params: '{"n":2}', mode: 'tactile' });
    expect(b.tip).toBe('interactive_manipulative');
  });
  it('kind static (venn) → respins (nu e tactil)', () => { expect(bad({ tip: 'interactive_manipulative', kind: 'venn', params: '{}' })).toBeTruthy(); });
});

describe('ETAPA 81 FAZA A — parameter_slider', () => {
  it('valid', () => {
    const b = ok({ tip: 'parameter_slider', expr_template: 'a*x^2', param: 'a', range: [-3, 3, 0.5], observe: 'forma parabolei' });
    expect(b.tip).toBe('parameter_slider');
  });
  it('range invalid (min≥max) → respins', () => { expect(bad({ tip: 'parameter_slider', expr_template: 'a*x', param: 'a', range: [3, 1, 0.5], observe: 'x' })).toMatch(/range/); });
  it('expr_template fără parametru → respins', () => { expect(bad({ tip: 'parameter_slider', expr_template: 'x^2', param: 'a', range: [-1, 1, 0.1], observe: 'x' })).toMatch(/parametr/); });
});

describe('ETAPA 81 FAZA A — try_step', () => {
  it('valid + strip ascunde expected', () => {
    const b = ok({ tip: 'try_step', prompt: 'Cât e 2+2?', expected: '4', hint: 'Adună. Numără pe degete.' }) as TryStepBlock;
    expect(b.expected).toBe('4');
    const client = stripTryStepAnswer(b, 't1') as Record<string, unknown>;
    expect(client.expected).toBeUndefined();
    expect(client.try_id).toBe('t1');
  });
  it('prompt prea lung → respins', () => { expect(bad({ tip: 'try_step', prompt: 'x'.repeat(400), expected: '1', hint: 'da.' })).toBeTruthy(); });
});

describe('ETAPA 81 FAZA A — vocab pe blocuri de proză', () => {
  it('intro acceptă vocab_level + variante', () => {
    const b = ok({ tip: 'intro', titlu: 'T', ideea_mare: 'Idee.', vocab_level: 'punte', variante: { comun: 'simplu', barem: 'riguros' } });
    expect(b.tip).toBe('intro');
  });
  it('vocab_level invalid → respins', () => { expect(bad({ tip: 'intro', titlu: 'T', ideea_mare: 'Idee.', vocab_level: 'gresit' })).toBeTruthy(); });
});
