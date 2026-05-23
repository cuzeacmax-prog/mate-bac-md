import type { Point } from './types';

function unitVector(from: Point, to: Point): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  return [dx / len, dy / len];
}

export function rightAngleMarkerTikz(V: Point, P1: Point, P2: Point, size = 0.2): string {
  const u1 = unitVector(V, P1);
  const u2 = unitVector(V, P2);
  const p1 = [V[0] + u1[0] * size, V[1] + u1[1] * size];
  const p2 = [V[0] + u1[0] * size + u2[0] * size, V[1] + u1[1] * size + u2[1] * size];
  const p3 = [V[0] + u2[0] * size, V[1] + u2[1] * size];
  return `\\draw[thick] (${p1[0].toFixed(3)},${p1[1].toFixed(3)}) -- (${p2[0].toFixed(3)},${p2[1].toFixed(3)}) -- (${p3[0].toFixed(3)},${p3[1].toFixed(3)});`;
}

export function equalAngleArcsTikz(
  V: Point,
  P1: Point,
  P2: Point,
  count = 1,
  baseRadius = 0.4,
): string {
  const arcs: string[] = [];
  const u1 = unitVector(V, P1);
  const u2 = unitVector(V, P2);
  const angle1 = Math.atan2(u1[1], u1[0]) * (180 / Math.PI);
  const angle2 = Math.atan2(u2[1], u2[0]) * (180 / Math.PI);
  let startAngle = angle1;
  let endAngle = angle2;
  if (endAngle < startAngle) endAngle += 360;
  if (endAngle - startAngle > 180) {
    [startAngle, endAngle] = [angle2, angle1 + (angle1 < angle2 ? 360 : 0)];
  }
  for (let i = 0; i < count; i++) {
    const r = baseRadius + i * 0.08;
    arcs.push(
      `\\draw[thick] (${V[0].toFixed(3)},${V[1].toFixed(3)}) ++(${startAngle.toFixed(2)}:${r.toFixed(3)}) arc (${startAngle.toFixed(2)}:${endAngle.toFixed(2)}:${r.toFixed(3)});`,
    );
  }
  return arcs.join('\n');
}

export function equalSegmentMarksTikz(P1: Point, P2: Point, count = 1, markSize = 0.12): string {
  const mid: [number, number] = [(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2];
  const dx = P2[0] - P1[0];
  const dy = P2[1] - P1[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpDx = (-dy / len) * markSize;
  const perpDy = (dx / len) * markSize;
  const alongDx = (dx / len) * 0.08;
  const alongDy = (dy / len) * 0.08;
  const marks: string[] = [];
  const offset = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const cx = mid[0] + (i - offset) * alongDx;
    const cy = mid[1] + (i - offset) * alongDy;
    marks.push(
      `\\draw[thick] (${(cx - perpDx).toFixed(3)},${(cy - perpDy).toFixed(3)}) -- (${(cx + perpDx).toFixed(3)},${(cy + perpDy).toFixed(3)});`,
    );
  }
  return marks.join('\n');
}
