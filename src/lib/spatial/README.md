# spatial — Geometrie spațială (3D)

Cabinet projection: `(x,y,z) → (x + 0.45z·cos30°, y + 0.45z·sin30°)`

## Fișiere

| Fișier | Funcție principală | Descriere |
|---|---|---|
| `projections3D.ts` | `generateProjection3D` | Paralelipiped + proiecție punct pe plan (bază, față frontală, față laterală) |
| `dihedralAngle.ts` | `generateDihedralAngle` | Unghi diedru — 2 semiplane cu muchia comună |
| `threePerp.ts` | `generateThreePerp` | Teorema celor 3 perpendiculare vizualizată pe plan |
| `index.ts` | Re-exporturi | — |

## API Endpoint

`POST /api/admin/generate-spatial` cu `type: 'projection' | 'dihedral' | 'three_perp'`
