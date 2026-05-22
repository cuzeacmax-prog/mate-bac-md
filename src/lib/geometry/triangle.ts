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
