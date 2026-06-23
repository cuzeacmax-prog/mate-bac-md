import { describe, it, expect } from 'vitest';
import { dedupFormulas, buildFormulaSheet } from '@/lib/formule/sheet';

describe('ETAPA 83 I — foaia de formule (R5: din conținut verificat, zero inventat)', () => {
  it('dedup colapsează variante echivalente (\\dfrac↔\\frac, spacing, \\mathrm{d}↔d)', () => {
    const out = dedupFormulas([
      '\\alpha = \\dfrac{2\\pi R}{G}',
      '\\alpha = \\frac{2\\pi R}{G}',
      '\\mathcal{A}=\\int_a^b f(x)\\,\\mathrm{d}x',
      '\\mathcal{A}=\\int_a^b f(x)dx',
    ]);
    expect(out.length).toBe(2);
  });

  it('păstrează formule distincte', () => {
    const out = dedupFormulas(['G^2 = R^2 + H^2', '\\mathcal{A}_L = \\pi R G']);
    expect(out.length).toBe(2);
  });

  it('ignoră goale / spații', () => {
    expect(dedupFormulas(['', '  ', 'x=1'])).toEqual(['x=1']);
  });

  it('buildFormulaSheet grupează pe concept și elimină secțiunile goale', () => {
    const sheet = buildFormulaSheet('Corpuri de rotație', [
      { slug: 'g12-con', name: 'conul', formulas: ['\\mathcal{A}_L = \\pi R G', '\\mathcal{A}_L = \\dfrac{1}{2}G^2\\alpha = \\pi R G'] },
      { slug: 'g12-gol', name: 'gol', formulas: ['', '  '] },
    ]);
    expect(sheet.sections.length).toBe(1);
    expect(sheet.sections[0].slug).toBe('g12-con');
    expect(sheet.title).toBe('Corpuri de rotație');
  });

  it('R5: NU adaugă nicio formulă care nu e în intrare', () => {
    const input = ['x^2'];
    const sheet = buildFormulaSheet('T', [{ slug: 's', name: 'n', formulas: input }]);
    for (const f of sheet.sections[0].formulas) {
      expect(input.some((i) => i === f)).toBe(true);
    }
  });

  it('count = suma formulelor deduplicate', () => {
    const sheet = buildFormulaSheet('T', [
      { slug: 'a', name: 'a', formulas: ['x=1', 'x=1', 'y=2'] },
      { slug: 'b', name: 'b', formulas: ['z=3'] },
    ]);
    expect(sheet.count).toBe(3);
  });
});
