import { describe, it, expect } from 'vitest';
import { generateCubeAdvanced, generateRectangularPrismAdvanced, cabinetProjection } from '../../src/lib/geometry/solid3d';

describe('cabinetProjection', () => {
  it('proiectează punctul origin corect', () => {
    const [x, y] = cabinetProjection([0, 0, 0]);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it('proiectează punctul [1,0,0] corect (nicio deplasare pe z)', () => {
    const [x, y] = cabinetProjection([1, 0, 0]);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
  });

  it('deplasare pe z afectează ambele axe 2D', () => {
    const [x, y] = cabinetProjection([0, 0, 1]);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });
});

describe('generateCubeAdvanced', () => {
  it('generează TikZ valid pentru cub cu side=4', () => {
    const result = generateCubeAdvanced({ side: 4 });
    expect(result.tikz).toContain('\\begin{tikzpicture}');
    expect(result.tikz).toContain('\\end{tikzpicture}');
  });

  it('calculează volumul corect pentru side=3', () => {
    const result = generateCubeAdvanced({ side: 3 });
    expect(result.computed.volume).toBeCloseTo(27, 1);
  });

  it('calculează aria suprafeței pentru side=4', () => {
    const result = generateCubeAdvanced({ side: 4 });
    expect(result.computed.surface_area).toBeCloseTo(96, 1);
  });

  it('conține pași de construcție', () => {
    const result = generateCubeAdvanced({ side: 5 });
    expect(result.construction_steps.length).toBeGreaterThan(0);
  });
});

describe('generateRectangularPrismAdvanced', () => {
  it('generează TikZ valid', () => {
    const result = generateRectangularPrismAdvanced({ length: 5, width: 4, height: 3 });
    expect(result.tikz).toContain('\\begin{tikzpicture}');
  });

  it('calculează volumul corect (length*width*height = 5*4*3 = 60)', () => {
    const result = generateRectangularPrismAdvanced({ length: 5, width: 4, height: 3 });
    expect(result.computed.volume).toBeCloseTo(60, 1);
  });

  it('calculează aria suprafeței corect (2*(lw+wh+lh) = 2*(20+12+15) = 94)', () => {
    const result = generateRectangularPrismAdvanced({ length: 5, width: 4, height: 3 });
    expect(result.computed.surface_area).toBeCloseTo(94, 1);
  });
});
