export type Point = readonly [number, number];

export interface Triangle {
  A: Point;
  B: Point;
  C: Point;
  sideA: number; // BC
  sideB: number; // CA
  sideC: number; // AB
}

export interface Circle {
  center: Point;
  radius: number;
}
