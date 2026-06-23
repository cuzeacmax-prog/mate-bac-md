import { describe, it, expect } from 'vitest';
import { groupHue, domainButton, oklchL } from '@/lib/map/domain-style';

describe('ETAPA 84 D — gradient ordonat pe butoanele de domeniu (albastru, determinist)', () => {
  it('groupHue e determinist și în banda albastră (210-280)', () => {
    const h = groupHue('g11:functia-radical');
    expect(h).toBeGreaterThanOrEqual(210);
    expect(h).toBeLessThanOrEqual(280);
    expect(groupHue('g11:functia-radical')).toBe(h);
  });

  it('domainButton: progres mai mare → bg mai luminos (codifică progresul)', () => {
    const lo = domainButton('g11:x', 0);
    const hi = domainButton('g11:x', 1);
    expect(oklchL(hi.bg)).toBeGreaterThan(oklchL(lo.bg));
  });

  it('luminozitatea bg e plafonată ≤ 0.46 (text deschis rămâne AA)', () => {
    for (const p of [0, 0.5, 1]) {
      expect(oklchL(domainButton('g11:x', p).bg)).toBeLessThanOrEqual(0.46);
    }
  });

  it('glow crește cu progresul (electric la stăpânit)', () => {
    expect(domainButton('g11:x', 1).glow).toBeGreaterThan(domainButton('g11:x', 0.2).glow);
  });

  it('tente diferite pentru grupuri diferite (distincție subtilă)', () => {
    expect(groupHue('g11:a')).not.toBe(groupHue('g11:bbbbb-different'));
  });

  it('determinist: aceeași intrare → aceeași ieșire', () => {
    expect(domainButton('g10:y', 0.42)).toEqual(domainButton('g10:y', 0.42));
  });
});
