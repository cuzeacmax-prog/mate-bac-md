import { describe, it, expect } from 'vitest';
import { generateCircleAdvanced } from '../../src/lib/geometry/circleAdvanced';

describe('generateCircleAdvanced', () => {
  it('generează TikZ valid pentru cerc simplu', () => {
    const result = generateCircleAdvanced({ radius: 4 });
    expect(result.tikz).toContain('\\begin{tikzpicture}');
    expect(result.tikz).toContain('\\end{tikzpicture}');
    expect(result.tikz).toContain('circle');
  });

  it('include centrul cercului în points ca O', () => {
    const result = generateCircleAdvanced({ radius: 4 });
    expect(result.points).toHaveProperty('O');
    const O = result.points['O'];
    expect(O[0]).toBeCloseTo(0);
    expect(O[1]).toBeCloseTo(0);
  });

  it('include raza când show_radius=true', () => {
    const result = generateCircleAdvanced({ radius: 3, show_radius: true });
    expect(result.tikz).toMatch(/draw.*--/);
  });

  it('conține pași de construcție', () => {
    const result = generateCircleAdvanced({ radius: 5 });
    expect(result.construction_steps.length).toBeGreaterThan(0);
  });

  it('calculează corect sector_area pentru 90° (angle1=0, angle2=90)', () => {
    const result = generateCircleAdvanced({
      radius: 4,
      highlight_sector: { angle1: 0, angle2: 90 },
    });
    // 90° / 360° * π * r² = π * 16 / 4 ≈ 12.57
    expect(result.computed.sector_area).toBeCloseTo(Math.PI * 16 / 4, 1);
  });
});
