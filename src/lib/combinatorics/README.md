# combinatorics — Diagrame Venn + arbori de probabilitate

## Fișiere

| Fișier | Funcție principală | Descriere |
|---|---|---|
| `venn.ts` | `generateVenn2`, `generateVenn3`, `generateVennDiagram` | Diagrame Venn 2/3 mulțimi cu `\clip` pentru intersecții corecte |
| `probabilityTree.ts` | `generateProbabilityTree` | Arbore orizontal cu probabilități pe muchii, frunze cu P cumulată |
| `index.ts` | Re-exporturi | — |

## Utilizare

```typescript
import { generateVenn2 } from '@/lib/combinatorics/venn';

const result = generateVenn2({
  sets: [{ label: 'A', count: 30 }, { label: 'B', count: 25 }],
  intersection: 10, universe: 60, show_counts: true,
});
```

## API Endpoint

`POST /api/admin/generate-probability` cu `type: 'venn2' | 'venn3' | 'tree'`
