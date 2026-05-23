# Geometry Library

Calculatoare geometrice pentru forme din curriculum BAC Moldova.
Fiecare calculator returnează TikZ code + construction_steps animabile.

## Shapes disponibile

| Modul | Funcție | Forme |
|---|---|---|
| `triangleAdvanced` | `generateTriangleAdvanced(input)` | Triunghi cu bisectoare, mediane, înălțimi, cercuri |
| `circleAdvanced` | `generateCircleAdvanced(input)` | Cerc cu coarde, tangente, secante, arc, sector |
| `quadrilateral` | `generateParallelogramAdvanced(input)` | Paralelogram, romb, dreptunghi, pătrat |
| `quadrilateral` | `generateTrapezoidAdvanced(input)` | Trapez (isoscel, dreptunghic, oarecare) |
| `polygon` | `generateRegularPolygonAdvanced(input)` | Poligon regulat (n ≥ 3) |
| `solid3d` | `generateCubeAdvanced(input)` | Cub (proiecție cabinet/izometrică) |
| `solid3d` | `generateRectangularPrismAdvanced(input)` | Paralelipiped dreptunghic |
| `pyramid` | `generateRegularPyramidAdvanced(input)` | Piramidă regulată (triunghi, pătrat, hexagon bază) |
| `rotational` | `generateCylinderAdvanced(input)` | Cilindru circular drept |
| `rotational` | `generateConeAdvanced(input)` | Con circular drept |
| `rotational` | `generateSphereAdvanced(input)` | Sferă |

## Exemple rapide

```typescript
import { generateTriangleAdvanced } from '@/lib/geometry';

// Triunghi dreptunghic 3-4-5
const result = generateTriangleAdvanced({
  a: 3, b: 4, c: 5,
  show_sides: true,
  auto_detect_right_angles: true,
});
// result.tikz → string pentru compilare
// result.construction_steps → animație pas-cu-pas
```

```typescript
import { generateCubeAdvanced } from '@/lib/geometry';

const cube = generateCubeAdvanced({ side: 4, show_diagonal_3d: true, label_vertices: true });
```

## Output structure

```typescript
{
  tikz: string;                // TikZ complet (begin{tikzpicture}...end{tikzpicture})
  points: Record<string, Point>; // Coordonatele 2D ale punctelor cheie
  computed: { ... };           // Valori calculate (arie, perimetru, etc.)
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;       // Text pedagogic
    cumulative_tikz: string;   // TikZ până la pasul curent
  }>;
}
```
