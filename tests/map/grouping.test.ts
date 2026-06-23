import { describe, it, expect } from 'vitest';
import { conceptGroupLabel, groupKeyFor } from '@/lib/map/grouping';

describe('ETAPA 84 B — gruparea robustă a conceptelor (module ?? subtopic ?? Altele)', () => {
  it('folosește module când există', () => {
    expect(conceptGroupLabel({ module: 'Modulul 4. Funcții derivabile', subtopic: 'derivate' })).toBe('Modulul 4. Funcții derivabile');
  });
  it('cade pe subtopic când module e gol/null', () => {
    expect(conceptGroupLabel({ module: null, subtopic: 'aria trapezului' })).toBe('aria trapezului');
    expect(conceptGroupLabel({ module: '', subtopic: 'aria trapezului' })).toBe('aria trapezului');
  });
  it('„Altele" doar când nici module nici subtopic', () => {
    expect(conceptGroupLabel({ module: null, subtopic: null })).toBe('Altele');
    expect(conceptGroupLabel({ module: '  ', subtopic: '  ' })).toBe('Altele');
  });
  it('groupKeyFor e stabil, prefixat pe clasă, slug-safe', () => {
    const k = groupKeyFor(11, 'Funcția radical. Ecuații iraționale');
    expect(k).toMatch(/^g11:/);
    expect(k).not.toMatch(/\s/);
    // determinist
    expect(groupKeyFor(11, 'Funcția radical. Ecuații iraționale')).toBe(k);
  });
  it('chei diferite pe clase diferite pentru aceeași etichetă', () => {
    expect(groupKeyFor(10, 'Funcții')).not.toBe(groupKeyFor(11, 'Funcții'));
  });
});
