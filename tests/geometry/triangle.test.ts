import { describe, it, expect } from 'vitest';
import { generateTriangleAdvanced } from '../../src/lib/geometry/triangleAdvanced';

describe('generateTriangleAdvanced', () => {
  it('generează TikZ valid pentru triunghi dreptunghic 3-4-5', () => {
    const result = generateTriangleAdvanced({ a: 3, b: 4, c: 5 });
    expect(result.tikz).toContain('\\begin{tikzpicture}');
    expect(result.tikz).toContain('\\end{tikzpicture}');
    expect(result.points).toHaveProperty('A');
    expect(result.points).toHaveProperty('B');
    expect(result.points).toHaveProperty('C');
  });

  it('calculează corect inradius cu show_incircle=true (r = 1 pentru 3-4-5)', () => {
    const result = generateTriangleAdvanced({ a: 3, b: 4, c: 5, show_incircle: true });
    expect(result.computed.inradius).toBeCloseTo(1, 2);
  });

  it('calculează corect circumradius cu show_circumcircle=true (R = 2.5 pentru 3-4-5)', () => {
    const result = generateTriangleAdvanced({ a: 3, b: 4, c: 5, show_circumcircle: true });
    expect(result.computed.circumradius).toBeCloseTo(2.5, 2);
  });

  it('detectează unghi drept la triunghi 3-4-5', () => {
    const result = generateTriangleAdvanced({ a: 3, b: 4, c: 5, auto_detect_right_angles: true });
    expect(result.computed.detected_right_angles.length).toBeGreaterThan(0);
  });

  it('conține pași de construcție', () => {
    const result = generateTriangleAdvanced({ a: 5, b: 6, c: 7 });
    expect(result.construction_steps.length).toBeGreaterThan(0);
    expect(result.construction_steps[0]).toHaveProperty('step');
    expect(result.construction_steps[0]).toHaveProperty('cumulative_tikz');
  });

  it('triunghi echilateral 5-5-5 — circumradius = 5*sqrt(3)/3', () => {
    const result = generateTriangleAdvanced({ a: 5, b: 5, c: 5, show_circumcircle: true });
    expect(result.tikz).toContain('\\begin{tikzpicture}');
    expect(result.computed.circumradius).toBeCloseTo((5 * Math.sqrt(3)) / 3, 1);
  });
});
