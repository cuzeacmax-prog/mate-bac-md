import { describe, it, expect } from 'vitest';
import {
  concreteExpr, curveObservables, rollDice, drawFromUrn, urnProbability, reorder, revealedAt, maxRevealStep,
} from '@/lib/lesson/interactive';

describe('ETAPA 81 FAZA B — slider: substituție parametru', () => {
  it('substituie ca token întreg', () => {
    expect(concreteExpr('a*x^2 + a', 'a', 2)).toBe('(2)*x^2 + (2)');
  });
  it('nu strică funcțiile (param a NU atinge tan)', () => {
    expect(concreteExpr('a*tan(x)', 'a', -1)).toBe('(-1)*tan(x)');
  });
});

describe('ETAPA 81 FAZA B — observabile curbă', () => {
  it('parabolă a>0: 2 rădăcini, vârf jos', () => {
    const xs: Array<{ x: number; y: number }> = [];
    for (let x = -3; x <= 3; x += 0.05) xs.push({ x, y: x * x - 1 }); // rădăcini ±1, vârf (0,-1)
    const o = curveObservables(xs);
    expect(o.roots).toBe(2);
    expect(o.vertex!.x).toBeCloseTo(0, 1);
    expect(o.vertex!.y).toBeCloseTo(-1, 1);
  });
  it('fără rădăcini reale (x²+1)', () => {
    const xs: Array<{ x: number; y: number }> = [];
    for (let x = -3; x <= 3; x += 0.05) xs.push({ x, y: x * x + 1 });
    expect(curveObservables(xs).roots).toBe(0);
  });
});

describe('ETAPA 81 FAZA B — manipulative tactile (reducere pură)', () => {
  it('zaruri: n valori în [1,faces]', () => {
    const seq = [0.0, 0.99]; let i = 0; const rng = () => seq[i++ % seq.length];
    const r = rollDice(2, 6, rng);
    expect(r).toEqual([1, 6]);
  });
  it('urnă: extragerea scade culoarea, probabilitatea se actualizează', () => {
    const urn = { rosu: 3, albastru: 1 };
    expect(urnProbability(urn, 'rosu')).toBeCloseTo(0.75);
    const { color, rest } = drawFromUrn(urn, () => 0); // prima bilă = roșu
    expect(color).toBe('rosu');
    expect(rest.rosu).toBe(2);
    expect(urnProbability(rest, 'rosu')).toBeCloseTo(2 / 3);
  });
  it('persoane: reorder mută elementul', () => {
    expect(reorder(['A', 'B', 'C'], 0, 2)).toEqual(['B', 'C', 'A']);
  });
});

describe('ETAPA 81 FAZA B — dezvăluire pe pași', () => {
  it('celula apare la pasul ei', () => {
    expect(revealedAt(2, 1)).toBe(false);
    expect(revealedAt(2, 2)).toBe(true);
  });
  it('maxRevealStep', () => { expect(maxRevealStep([0, 2, 1])).toBe(2); });
});
