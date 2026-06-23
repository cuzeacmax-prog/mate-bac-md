import { describe, it, expect } from 'vitest';
import { masteryColor, relLuminance, type NodeStatusLite } from '@/lib/map/mastery-color';

describe('ETAPA 83 C — gradient ordonat pe noduri (mastery → albastru, determinist)', () => {
  it('mastery 0 = albastru profund (închis); mastery 1 = electric (deschis)', () => {
    const lo = masteryColor(0, 'disponibil');
    const hi = masteryColor(1, 'stapanit');
    expect(relLuminance(lo.fill)).toBeLessThan(relLuminance(hi.fill));
    // capătul de jos e aproape de #001D51, capătul de sus aproape de #3B82F6
    expect(lo.fill.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(hi.fill.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('monoton: mai mult mastery → mai luminos (codifică progresia)', () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map((m) => relLuminance(masteryColor(m, 'in-lucru').fill));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });

  it('determinist: aceeași intrare → aceeași ieșire (zero random)', () => {
    expect(masteryColor(0.42, 'in-lucru')).toEqual(masteryColor(0.42, 'in-lucru'));
  });

  it('blocat e mai stins decât disponibil la mastery 0', () => {
    const blocat = masteryColor(0, 'blocat');
    const disp = masteryColor(0, 'disponibil');
    expect(relLuminance(blocat.fill)).toBeLessThanOrEqual(relLuminance(disp.fill));
  });

  it('stăpânit are glow mai puternic decât în-lucru', () => {
    expect(masteryColor(1, 'stapanit').glow).toBeGreaterThan(masteryColor(0.5, 'in-lucru').glow);
  });

  it('clamp: valori în afara [0,1] nu sparg', () => {
    expect(masteryColor(-1, 'blocat').fill).toMatch(/^#[0-9a-f]{6}$/i);
    expect(masteryColor(5, 'stapanit').fill).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('toate cele 4 stări produc culori valide', () => {
    for (const s of ['blocat', 'disponibil', 'in-lucru', 'stapanit'] as NodeStatusLite[]) {
      expect(masteryColor(0.5, s).fill).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
