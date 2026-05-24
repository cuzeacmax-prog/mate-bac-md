/**
 * rotation.ts — Rotation transformation visualization.
 * Rotates points around a center by a given angle.
 * ZERO AI — pure math + TikZ.
 */

import { fmt, fmtLabel, type GraphOutput } from '../analysis/_helpers';

export interface RotationInput {
  points: Array<{ x: number; y: number; label?: string }>;
  center?: { x: number; y: number }; // default origin
  angle_deg: number;
  domain?: [number, number];
  show_grid?: boolean;
  show_arcs?: boolean;  // show rotation arcs
}

function rotatePoint(px: number, py: number, cx: number, cy: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  return [rx + cx, ry + cy];
}

export function generateRotation(input: RotationInput): GraphOutput {
  const cx = input.center?.x ?? 0;
  const cy = input.center?.y ?? 0;
  const angleDeg = input.angle_deg;
  const range = input.domain ?? [-6, 6];
  const [rmin, rmax] = range;

  let tikz = `\\begin{tikzpicture}[scale=0.7, >=stealth]\n`;

  if (input.show_grid) {
    tikz += `  \\draw[gray!20] (${fmt(rmin)},${fmt(rmin)}) grid (${fmt(rmax)},${fmt(rmax)});\n`;
  }

  tikz += `  \\draw[->, thick] (${fmt(rmin - 0.2)},0) -- (${fmt(rmax + 0.3)},0) node[right] {$x$};\n`;
  tikz += `  \\draw[->, thick] (0,${fmt(rmin - 0.2)}) -- (0,${fmt(rmax + 0.3)}) node[above] {$y$};\n`;

  // Center of rotation
  tikz += `  \\filldraw[orange] (${fmt(cx)},${fmt(cy)}) circle (0.1) node[below right, font=\\small] {$O'(${fmtLabel(cx)},${fmtLabel(cy)})$};\n`;

  // Rotation label
  tikz += `  \\node[orange!80!black, font=\\small] at (${fmt(rmax - 1)},${fmt(rmax - 0.3)}) {$R_{${fmtLabel(angleDeg)}°}$};\n`;

  const colors = ['blue!70', 'red!70', 'green!60!black', 'violet'];
  const computed: Array<{ original: [number, number]; rotated: [number, number] }> = [];

  for (let i = 0; i < input.points.length; i++) {
    const pt = input.points[i];
    const color = colors[i % colors.length];
    const lbl = pt.label ?? String.fromCharCode(65 + i);

    const [rx, ry] = rotatePoint(pt.x, pt.y, cx, cy, angleDeg);

    // Original
    tikz += `  \\filldraw[${color}] (${fmt(pt.x)},${fmt(pt.y)}) circle (0.09) node[above right, font=\\small] {$${lbl}$};\n`;
    // Rotated
    tikz += `  \\filldraw[${color}, opacity=0.6] (${fmt(rx)},${fmt(ry)}) circle (0.09) node[above right, font=\\small, opacity=0.8] {$${lbl}'$};\n`;

    // Arc from original to rotated
    if (input.show_arcs !== false) {
      const dist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
      if (dist > 0.1) {
        const startAngle = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI;
        const endAngle = startAngle + angleDeg;
        tikz += `  \\draw[${color}, thin, dashed, ->] (${fmt(pt.x)},${fmt(pt.y)}) arc (${fmt(startAngle)}:${fmt(endAngle)}:${fmt(dist)});\n`;
      }
    }

    // Line from center to each
    tikz += `  \\draw[${color}, very thin, opacity=0.3] (${fmt(cx)},${fmt(cy)}) -- (${fmt(pt.x)},${fmt(pt.y)});\n`;
    tikz += `  \\draw[${color}, very thin, opacity=0.3] (${fmt(cx)},${fmt(cy)}) -- (${fmt(rx)},${fmt(ry)});\n`;

    computed.push({ original: [pt.x, pt.y], rotated: [rx, ry] });
  }

  tikz += `\\end{tikzpicture}`;

  return {
    tikz,
    computed: {
      center: [cx, cy],
      angle_deg: angleDeg,
      points: computed,
    },
  };
}
