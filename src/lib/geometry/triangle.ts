import type { Point, Triangle } from './types';

export function validateTriangle(a: number, b: number, c: number): void {
  if (a <= 0 || b <= 0 || c <= 0) {
    throw new Error('Sides must be positive');
  }
  if (a + b <= c || b + c <= a || a + c <= b) {
    throw new Error('Triangle inequality violated');
  }
}

/**
 * Compute triangle vertices from 3 sides.
 * B at origin, C on positive X axis, A computed above.
 */
export function triangleVerticesFromSides(a: number, b: number, c: number): Triangle {
  validateTriangle(a, b, c);

  const B: Point = [0, 0];
  const C: Point = [a, 0];

  // A: intersection of circles centered at B (radius c) and C (radius b)
  const Ax = (c * c + a * a - b * b) / (2 * a);
  const Ay = Math.sqrt(Math.max(0, c * c - Ax * Ax));
  const A: Point = [Ax, Ay];

  return { A, B, C, sideA: a, sideB: b, sideC: c };
}

export function triangleArea(t: Triangle): number {
  const s = (t.sideA + t.sideB + t.sideC) / 2;
  return Math.sqrt(s * (s - t.sideA) * (s - t.sideB) * (s - t.sideC));
}

export function incenter(t: Triangle): Point {
  const sum = t.sideA + t.sideB + t.sideC;
  return [
    (t.sideA * t.A[0] + t.sideB * t.B[0] + t.sideC * t.C[0]) / sum,
    (t.sideA * t.A[1] + t.sideB * t.B[1] + t.sideC * t.C[1]) / sum,
  ];
}

export function inradius(t: Triangle): number {
  const s = (t.sideA + t.sideB + t.sideC) / 2;
  return triangleArea(t) / s;
}

export function circumcenter(t: Triangle): Point {
  const D =
    2 *
    (t.A[0] * (t.B[1] - t.C[1]) +
      t.B[0] * (t.C[1] - t.A[1]) +
      t.C[0] * (t.A[1] - t.B[1]));
  const ux =
    ((t.A[0] ** 2 + t.A[1] ** 2) * (t.B[1] - t.C[1]) +
      (t.B[0] ** 2 + t.B[1] ** 2) * (t.C[1] - t.A[1]) +
      (t.C[0] ** 2 + t.C[1] ** 2) * (t.A[1] - t.B[1])) /
    D;
  const uy =
    ((t.A[0] ** 2 + t.A[1] ** 2) * (t.C[0] - t.B[0]) +
      (t.B[0] ** 2 + t.B[1] ** 2) * (t.A[0] - t.C[0]) +
      (t.C[0] ** 2 + t.C[1] ** 2) * (t.B[0] - t.A[0])) /
    D;
  return [ux, uy];
}

export function circumradius(t: Triangle): number {
  return (t.sideA * t.sideB * t.sideC) / (4 * triangleArea(t));
}

export function centroid(t: Triangle): Point {
  return [
    (t.A[0] + t.B[0] + t.C[0]) / 3,
    (t.A[1] + t.B[1] + t.C[1]) / 3,
  ];
}

export function midpoint(p1: Point, p2: Point): Point {
  return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
}

export function triangleAngles(t: Triangle): { A: number; B: number; C: number } {
  const radToDeg = 180 / Math.PI;
  const angleA = Math.acos((t.sideB * t.sideB + t.sideC * t.sideC - t.sideA * t.sideA) / (2 * t.sideB * t.sideC)) * radToDeg;
  const angleB = Math.acos((t.sideA * t.sideA + t.sideC * t.sideC - t.sideB * t.sideB) / (2 * t.sideA * t.sideC)) * radToDeg;
  const angleC = 180 - angleA - angleB;
  return { A: angleA, B: angleB, C: angleC };
}

export function detectRightAngles(
  angles: { A: number; B: number; C: number },
  tolerance = 0.5,
): string[] {
  const result: string[] = [];
  if (Math.abs(angles.A - 90) < tolerance) result.push('A');
  if (Math.abs(angles.B - 90) < tolerance) result.push('B');
  if (Math.abs(angles.C - 90) < tolerance) result.push('C');
  return result;
}

export function detectEqualAngles(
  angles: { A: number; B: number; C: number },
  tolerance = 0.5,
): string[][] {
  const groups: string[][] = [];
  const used = new Set<string>();
  const entries = Object.entries(angles) as Array<['A' | 'B' | 'C', number]>;
  for (let i = 0; i < entries.length; i++) {
    if (used.has(entries[i][0])) continue;
    const group: string[] = [entries[i][0]];
    for (let j = i + 1; j < entries.length; j++) {
      if (Math.abs(entries[i][1] - entries[j][1]) < tolerance) {
        group.push(entries[j][0]);
        used.add(entries[j][0]);
      }
    }
    if (group.length > 1) groups.push(group);
    used.add(entries[i][0]);
  }
  return groups;
}

export function detectEqualSides(t: Triangle, tolerance = 0.001): string[][] {
  const sides = [
    { name: 'a', val: t.sideA },
    { name: 'b', val: t.sideB },
    { name: 'c', val: t.sideC },
  ];
  const groups: string[][] = [];
  const used = new Set<string>();
  for (let i = 0; i < sides.length; i++) {
    if (used.has(sides[i].name)) continue;
    const group: string[] = [sides[i].name];
    for (let j = i + 1; j < sides.length; j++) {
      if (Math.abs(sides[i].val - sides[j].val) < tolerance) {
        group.push(sides[j].name);
        used.add(sides[j].name);
      }
    }
    if (group.length > 1) groups.push(group);
    used.add(sides[i].name);
  }
  return groups;
}

// Bisector from vertex V meets the opposite side at the returned point.
// By the angle bisector theorem: BD/DC = c/b for vertex A, etc.
export function bisectorFootFrom(vertex: 'A' | 'B' | 'C', t: Triangle): Point {
  if (vertex === 'A') {
    const ratio = t.sideC / (t.sideB + t.sideC);
    return [t.B[0] + ratio * (t.C[0] - t.B[0]), t.B[1] + ratio * (t.C[1] - t.B[1])];
  }
  if (vertex === 'B') {
    const ratio = t.sideA / (t.sideA + t.sideC);
    return [t.C[0] + ratio * (t.A[0] - t.C[0]), t.C[1] + ratio * (t.A[1] - t.C[1])];
  }
  const ratio = t.sideB / (t.sideA + t.sideB);
  return [t.A[0] + ratio * (t.B[0] - t.A[0]), t.A[1] + ratio * (t.B[1] - t.A[1])];
}

export function medianFootFrom(vertex: 'A' | 'B' | 'C', t: Triangle): Point {
  if (vertex === 'A') return midpoint(t.B, t.C);
  if (vertex === 'B') return midpoint(t.C, t.A);
  return midpoint(t.A, t.B);
}

export function altitudeFootFrom(vertex: 'A' | 'B' | 'C', t: Triangle): Point {
  let V: Point, P1: Point, P2: Point;
  if (vertex === 'A') { V = t.A; P1 = t.B; P2 = t.C; }
  else if (vertex === 'B') { V = t.B; P1 = t.C; P2 = t.A; }
  else { V = t.C; P1 = t.A; P2 = t.B; }
  const dx = P2[0] - P1[0];
  const dy = P2[1] - P1[1];
  const proj = ((V[0] - P1[0]) * dx + (V[1] - P1[1]) * dy) / (dx * dx + dy * dy);
  return [P1[0] + proj * dx, P1[1] + proj * dy];
}
