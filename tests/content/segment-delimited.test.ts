import { describe, it, expect } from 'vitest';
import { segmentDelimitedMath } from '@/lib/content-math';

describe('segmentDelimitedMath (ETAPA 62 — MathText)', () => {
  it('text fără delimitatori rămâne un singur segment text', () => {
    const segs = segmentDelimitedMath('Să se afle lungimea razei sferei înscrise în con.');
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe('text');
  });

  it('extrage $...$ inline și păstrează textul românesc ca text', () => {
    const segs = segmentDelimitedMath('Înălțimea conului are $8\\,cm$, iar generatoarea $10\\,cm$.');
    expect(segs.map((s) => s.type)).toEqual(['text', 'math', 'text', 'math', 'text']);
    expect(segs[1].value).toBe('8\\,cm');
    expect(segs[1].display).toBe(false);
    expect(segs[1].raw).toBe('$8\\,cm$');
  });

  it('$$...$$ devine display math', () => {
    const segs = segmentDelimitedMath('Avem $$\\int_0^1 x\\,dx = \\frac{1}{2}$$ deci aria e 1/2.');
    const math = segs.find((s) => s.type === 'math');
    expect(math?.display).toBe(true);
    expect(math?.value).toContain('\\int_0^1');
  });

  it('\\(...\\) și \\[...\\] sunt recunoscute', () => {
    const segs = segmentDelimitedMath('fie \\(x^2\\) și \\[y=2x\\]');
    const maths = segs.filter((s) => s.type === 'math');
    expect(maths).toHaveLength(2);
    expect(maths[0].display).toBe(false);
    expect(maths[1].display).toBe(true);
  });

  it('LaTeX nedelimitat (comenzi \\cmd în proză) NU se randează — rămâne text', () => {
    const segs = segmentDelimitedMath('formula \\frac{a}{b} fără delimitatori');
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe('text');
  });

  it('text gol → zero segmente', () => {
    expect(segmentDelimitedMath('')).toEqual([]);
  });

  it('dolar american singur nu declanșează math peste linii', () => {
    const segs = segmentDelimitedMath('costă 5$ pe lună\nși 3$ pe zi');
    expect(segs.every((s) => s.type === 'text')).toBe(true);
  });
});
