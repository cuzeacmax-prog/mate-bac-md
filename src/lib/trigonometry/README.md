# trigonometry — Trigonometrie geometrică

## Fișiere

| Fișier | Funcție principală | Descriere |
|---|---|---|
| `trigCircle.ts` | `generateTrigCircle` | Cerc unitar cu proiecții sin/cos, unghiuri speciale, tangentă |
| `triangleTrig.ts` | `generateRightTriangleTrig` | Triunghi dreptunghic cu rapoarte sin/cos/tan |
| `reduction.ts` | `generateAngleReduction` | Reducere unghi la ascuțit: formulele de reducere pe cadrane |
| `index.ts` | Re-exporturi | — |

## API Endpoint

`POST /api/admin/generate-trig` cu `type: 'trig_circle' | 'right_triangle' | 'reduction'`
