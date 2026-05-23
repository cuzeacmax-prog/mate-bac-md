import * as Tri from './triangle';
import * as Markers from './markers';
import type { Point, Triangle } from './types';

export interface TriangleAdvancedInput {
  a: number;
  b: number;
  c: number;

  show_sides?: boolean;
  show_angles?: boolean;
  show_vertices?: boolean;

  auto_detect_right_angles?: boolean;
  auto_detect_equal_angles?: boolean;
  auto_detect_equal_sides?: boolean;

  show_incircle?: boolean;
  show_circumcircle?: boolean;

  constructions?: Array<{
    type: 'bisector' | 'median' | 'altitude';
    from: 'A' | 'B' | 'C';
    label?: string;
    color?: string;
    show_label?: boolean;
  }>;
}

export interface TriangleAdvancedOutput {
  tikz: string;
  points: Record<string, Point>;
  angles: { A: number; B: number; C: number };
  computed: {
    incenter?: Point;
    inradius?: number;
    circumcenter?: Point;
    circumradius?: number;
    centroid?: Point;
    detected_right_angles: string[];
    detected_equal_angles: string[][];
    detected_equal_sides: string[][];
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    elements_added: string[];
    cumulative_tikz: string;
  }>;
}

export function generateTriangleAdvanced(input: TriangleAdvancedInput): TriangleAdvancedOutput {
  const triangle: Triangle = Tri.triangleVerticesFromSides(input.a, input.b, input.c);
  const { A, B, C } = triangle;
  const angles = Tri.triangleAngles(triangle);

  const rightAngles = input.auto_detect_right_angles ? Tri.detectRightAngles(angles) : [];
  const equalAngles = input.auto_detect_equal_angles ? Tri.detectEqualAngles(angles) : [];
  const equalSides = input.auto_detect_equal_sides ? Tri.detectEqualSides(triangle) : [];

  const points: Record<string, Point> = { A, B, C };

  const incenter = input.show_incircle ? Tri.incenter(triangle) : undefined;
  const inradius = input.show_incircle ? Tri.inradius(triangle) : undefined;
  const circumcenter = input.show_circumcircle ? Tri.circumcenter(triangle) : undefined;
  const circumradius = input.show_circumcircle ? Tri.circumradius(triangle) : undefined;
  if (incenter) points['I'] = incenter;
  if (circumcenter) points['O'] = circumcenter;

  type ConstructionLine = { tikz: string; label: string; description: string };
  const constructionLines: ConstructionLine[] = [];

  if (input.constructions) {
    for (const con of input.constructions) {
      let footPoint: Point;
      let defaultLabel: string;
      let color = con.color ?? 'red!75!black';
      let description: string;

      if (con.type === 'bisector') {
        footPoint = Tri.bisectorFootFrom(con.from, triangle);
        defaultLabel = con.from === 'A' ? 'D' : con.from === 'B' ? 'E' : 'F';
        description = `Bisectoarea din ${con.from} intersectează latura opusă în ${con.label ?? defaultLabel}`;
      } else if (con.type === 'median') {
        footPoint = Tri.medianFootFrom(con.from, triangle);
        defaultLabel = con.from === 'A' ? 'M_a' : con.from === 'B' ? 'M_b' : 'M_c';
        color = con.color ?? 'green!60!black';
        description = `Mediana din ${con.from} ajunge la mijlocul ${con.label ?? defaultLabel}`;
      } else {
        footPoint = Tri.altitudeFootFrom(con.from, triangle);
        defaultLabel = con.from === 'A' ? 'H_a' : con.from === 'B' ? 'H_b' : 'H_c';
        color = con.color ?? 'orange!80!black';
        description = `Înălțimea din ${con.from} cade în ${con.label ?? defaultLabel}`;
      }

      const label = con.label ?? defaultLabel;
      points[label] = footPoint;
      const vertexPos = con.from === 'A' ? A : con.from === 'B' ? B : C;
      constructionLines.push({
        tikz: `\\draw[thick, ${color}] (${vertexPos[0].toFixed(3)},${vertexPos[1].toFixed(3)}) -- (${footPoint[0].toFixed(3)},${footPoint[1].toFixed(3)});`,
        label,
        description,
      });
    }
  }

  const steps: TriangleAdvancedOutput['construction_steps'] = [];
  let cumulativeTikz = '\\begin{tikzpicture}[scale=1.3, line cap=round, line join=round]\n';

  // Step 1: triangle + vertex labels
  let step1Tikz = `  \\draw[ultra thick, blue!70!black] (${A[0].toFixed(3)},${A[1].toFixed(3)}) -- (${B[0].toFixed(3)},${B[1].toFixed(3)}) -- (${C[0].toFixed(3)},${C[1].toFixed(3)}) -- cycle;`;
  if (input.show_vertices !== false) {
    step1Tikz += `\n  \\node[above=3pt] at (${A[0].toFixed(3)},${A[1].toFixed(3)}) {$A$};`;
    step1Tikz += `\n  \\node[below left=3pt] at (${B[0].toFixed(3)},${B[1].toFixed(3)}) {$B$};`;
    step1Tikz += `\n  \\node[below right=3pt] at (${C[0].toFixed(3)},${C[1].toFixed(3)}) {$C$};`;
  }
  cumulativeTikz += step1Tikz + '\n';
  steps.push({
    step: 1,
    title: 'Construim triunghiul ABC',
    explanation: `Trasăm triunghiul ABC cu laturile a=${input.a}, b=${input.b}, c=${input.c}.`,
    elements_added: ['triangle', 'vertex_labels'],
    cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
  });

  // Step 2: pedagogical markers
  let markersTikz = '';
  for (const ra of rightAngles) {
    const V = ra === 'A' ? A : ra === 'B' ? B : C;
    const others: [Point, Point] = ra === 'A' ? [B, C] : ra === 'B' ? [A, C] : [A, B];
    markersTikz += '  ' + Markers.rightAngleMarkerTikz(V, others[0], others[1]) + '\n';
  }
  equalAngles.forEach((group, idx) => {
    for (const vertex of group) {
      const V = vertex === 'A' ? A : vertex === 'B' ? B : C;
      const others: [Point, Point] = vertex === 'A' ? [B, C] : vertex === 'B' ? [A, C] : [A, B];
      markersTikz += '  ' + Markers.equalAngleArcsTikz(V, others[0], others[1], idx + 1) + '\n';
    }
  });
  equalSides.forEach((group, idx) => {
    for (const side of group) {
      let P1: Point, P2: Point;
      if (side === 'a') { P1 = B; P2 = C; }
      else if (side === 'b') { P1 = C; P2 = A; }
      else { P1 = A; P2 = B; }
      markersTikz += '  ' + Markers.equalSegmentMarksTikz(P1, P2, idx + 1) + '\n';
    }
  });
  if (markersTikz.trim()) {
    cumulativeTikz += markersTikz;
    const explanationParts: string[] = [];
    if (rightAngles.length > 0) explanationParts.push(`Unghi drept la ${rightAngles.join(', ')}`);
    if (equalAngles.length > 0) explanationParts.push('Unghiuri egale marcate cu arce');
    if (equalSides.length > 0) explanationParts.push('Laturi egale marcate cu hash');
    steps.push({
      step: steps.length + 1,
      title: 'Marcaje pedagogice',
      explanation: explanationParts.join('. ') + '.',
      elements_added: ['markers'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Step: incircle
  if (incenter && inradius !== undefined) {
    cumulativeTikz += `  \\draw[thick, red!75!black] (${incenter[0].toFixed(3)},${incenter[1].toFixed(3)}) circle (${inradius.toFixed(3)});\n`;
    cumulativeTikz += `  \\fill[black] (${incenter[0].toFixed(3)},${incenter[1].toFixed(3)}) circle (0.05);\n`;
    cumulativeTikz += `  \\node[right=2pt] at (${incenter[0].toFixed(3)},${incenter[1].toFixed(3)}) {$I$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Construim cercul înscris',
      explanation: `Cercul înscris are centrul I (incentrul triunghiului) și raza r=${inradius.toFixed(3)}.`,
      elements_added: ['incircle', 'I'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Step: circumcircle
  if (circumcenter && circumradius !== undefined) {
    cumulativeTikz += `  \\draw[thick, purple!75!black] (${circumcenter[0].toFixed(3)},${circumcenter[1].toFixed(3)}) circle (${circumradius.toFixed(3)});\n`;
    cumulativeTikz += `  \\fill[black] (${circumcenter[0].toFixed(3)},${circumcenter[1].toFixed(3)}) circle (0.05);\n`;
    cumulativeTikz += `  \\node[right=2pt] at (${circumcenter[0].toFixed(3)},${circumcenter[1].toFixed(3)}) {$O$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Construim cercul circumscris',
      explanation: `Cercul circumscris are centrul O (circumcentrul) și raza R=${circumradius.toFixed(3)}.`,
      elements_added: ['circumcircle', 'O'],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Steps: constructions (one per line)
  for (const line of constructionLines) {
    cumulativeTikz += '  ' + line.tikz + '\n';
    const foot = points[line.label];
    if (foot) {
      cumulativeTikz += `  \\fill[black] (${foot[0].toFixed(3)},${foot[1].toFixed(3)}) circle (0.04);\n`;
      cumulativeTikz += `  \\node[below=2pt] at (${foot[0].toFixed(3)},${foot[1].toFixed(3)}) {$${line.label}$};\n`;
    }
    steps.push({
      step: steps.length + 1,
      title: line.description,
      explanation: line.description,
      elements_added: [line.label],
      cumulative_tikz: cumulativeTikz + '\\end{tikzpicture}',
    });
  }

  // Side annotations (not a separate step — included in final tikz only)
  if (input.show_sides) {
    cumulativeTikz += `  \\node[below=4pt] at (${((B[0] + C[0]) / 2).toFixed(3)},${((B[1] + C[1]) / 2).toFixed(3)}) {$a=${input.a}$};\n`;
    cumulativeTikz += `  \\node[above left=2pt] at (${((A[0] + B[0]) / 2).toFixed(3)},${((A[1] + B[1]) / 2).toFixed(3)}) {$c=${input.c}$};\n`;
    cumulativeTikz += `  \\node[above right=2pt] at (${((A[0] + C[0]) / 2).toFixed(3)},${((A[1] + C[1]) / 2).toFixed(3)}) {$b=${input.b}$};\n`;
  }

  cumulativeTikz += '\\end{tikzpicture}';

  return {
    tikz: cumulativeTikz,
    points,
    angles,
    computed: {
      incenter,
      inradius,
      circumcenter,
      circumradius,
      detected_right_angles: rightAngles,
      detected_equal_angles: equalAngles,
      detected_equal_sides: equalSides,
    },
    construction_steps: steps,
  };
}
