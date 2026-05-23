# Biblioteca de Forme Geometrice

Fiecare formă e implementată ca funcție TypeScript pură în `src/lib/geometry/`.
Input → TikZ string + coordonate puncte + valori calculate + pași de construcție animabili.

## Referință rapidă

| Modul | Funcție | Input cheie |
|---|---|---|
| `triangleAdvanced` | `generateTriangleAdvanced` | `a, b, c` (laturi SSS) sau `a, B, c` (SAS) |
| `circleAdvanced` | `generateCircleAdvanced` | `radius`, opțional: `chords[]`, `tangents[]`, `secants[]` |
| `quadrilateral` | `generateParallelogramAdvanced` | `base, side, angle` |
| `quadrilateral` | `generateTrapezoidAdvanced` | `base_long, base_short, height` |
| `polygon` | `generateRegularPolygonAdvanced` | `sides, side_length` |
| `solid3d` | `generateCubeAdvanced` | `side` |
| `solid3d` | `generateRectangularPrismAdvanced` | `width, height, depth` |
| `pyramid` | `generateRegularPyramidAdvanced` | `base_sides, base_length, height` |
| `rotational` | `generateCylinderAdvanced` | `radius, height` |
| `rotational` | `generateConeAdvanced` | `radius, height` |
| `rotational` | `generateSphereAdvanced` | `radius` |

## Output comun

```typescript
{
  tikz: string;                    // TikZ complet (begin/end tikzpicture)
  points: Record<string, Point>;   // Puncte 2D cheie
  computed: {                      // Valori calculate specifice formei
    area?: number;
    perimeter?: number;
    // ...
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;       // TikZ cumulativ pana la pasul curent
  }>;
}
```

## Proiecție 3D (cabinet)

Solidele 3D folosesc proiecția cabinet:
```
x_2d = x + 0.45 * z * cos(30°)
y_2d = y + 0.45 * z * sin(30°)
```

Muchii ascunse: linie întreruptă gri (`dashed, gray`).
Muchii vizibile: linie continuă neagră.

## Ellipse perspective (rotaționale)

Factorul de perspectivă pentru elipse: `EY = 0.3`.
Elipsa bazei: `\ellipse({r} and {r * 0.3})`.

## Testare interactivă

Pagina `/admin/test-construction` permite testarea oricărei forme cu parametri custom și
vizualizarea fiecărui pas de construcție.
