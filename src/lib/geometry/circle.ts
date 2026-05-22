import type { Point, Circle } from './types';

export function pointAtAngle(circle: Circle, thetaRadians: number): Point {
  return [
    circle.center[0] + circle.radius * Math.cos(thetaRadians),
    circle.center[1] + circle.radius * Math.sin(thetaRadians),
  ];
}

export function pointAtAngleDeg(circle: Circle, thetaDegrees: number): Point {
  return pointAtAngle(circle, (thetaDegrees * Math.PI) / 180);
}

export function isPointOnCircle(point: Point, circle: Circle, tolerance = 0.001): boolean {
  const dx = point[0] - circle.center[0];
  const dy = point[1] - circle.center[1];
  return Math.abs(Math.sqrt(dx * dx + dy * dy) - circle.radius) < tolerance;
}
