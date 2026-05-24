# transformations — Transformări geometrice plane

## Fișiere

| Fișier | Funcție principală | Descriere |
|---|---|---|
| `symmetry.ts` | `generateSymmetry` | Simetrie axială (față de x, y, y=x, y=-x, x=k) sau centrală |
| `translation.ts` | `generateTranslation` | Translație cu vector (dx, dy) |
| `rotation.ts` | `generateRotation` | Rotație în jurul unui centru cu unghi dat (grade) |
| `homothety.ts` | `generateHomothety` | Omotetie față de un centru cu raport k |
| `index.ts` | Re-exporturi | — |

## API Endpoint

`POST /api/admin/generate-transformation` cu `type: 'symmetry' | 'translation' | 'rotation' | 'homothety'`
