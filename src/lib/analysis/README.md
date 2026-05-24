# analysis — Calculatoare funcții + analiză matematică

Calculator pur matematic (ZERO AI), generează TikZ pentru compilare Railway.

## Fișiere

| Fișier | Funcție principală | Descriere |
|---|---|---|
| `_helpers.ts` | Utilitare shared | `fmt`, `fmtLabel`, `evaluateExpression`, `sampleFunction`, `sampleFunctionSmart`, `generateAxesTikz`, `piAxisTicks`, etc. |
| `functionElementary.ts` | 8 funcții elementare | Liniară, pătratică, putere, radical, exponențială, logaritmică, modul, generică |
| `functionTrig.ts` | Funcții trigonometrice | sin/cos/tan/cot cu A·f(Bx+C)+D, discontinuități, asimptote tan/cot |
| `asymptotes.ts` | Asimptote | Verticale, orizontale, oblice |
| `limits.ts` | Limite | Vizualizare cu săgeți de abordare, puncte deschise/închise |
| `tangent.ts` | Tangentă | Dreapta tangentă + derivată numerică |
| `derivativeApplications.ts` | Monotonie + extreme | Intervale colorate (verde=cresc, roșu=descresc) |
| `integral.ts` | Integrală definită | Arie colorată + sume Riemann |
| `rotationVolume.ts` | Corp de rotație | Volum prin metoda discului/șaibei |
| `index.ts` | Re-exporturi | Toate exporturile |

## Utilizare

```typescript
import { generateLinearFunctionPlot } from '@/lib/analysis/functionElementary';
import { generateTrigFunctionPlot } from '@/lib/analysis/functionTrig';
import { compileTikz } from '@/lib/tikz/compile';

const result = generateLinearFunctionPlot({ a: 2, b: -1, show_grid: true });
const { svg } = await compileTikz(result.tikz);
```

## API Endpoint

`POST /api/admin/generate-function` — funcții elementare  
`POST /api/admin/generate-trig` — funcții trig + cerc trig  
`POST /api/admin/generate-analysis` — asimptote, limite, tangentă, monotonie, integrală, volum rotație

## Note importante

- `sampleFunctionSmart` detectează discontinuități (salt > 50% din range) și inserează `null`
- Expresiile sunt evaluate cu `new Function()` — whitelist de funcții matematice
- Toate calculele numerice: derivată = diferențe finite, integrală = sume Riemann (n=1000)
