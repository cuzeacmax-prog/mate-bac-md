# ETAPA 84 FAZA A — Diagnoza bug-ului de afișare (cauza, nu simptomul)

## Simptom
Harta clasei 11 afișează „1 temă", deși în DB sunt 234 concepte de clasa 11 / 20 module.

## Lanțul query → randare
1. `/app/app/harta/page.tsx` → `getKnowledgeMap(service, userId, grade)`.
2. `src/lib/map/state.ts:112-141` — construiește harta iterând **`MODULE_DOMAINS`**
   (cele 7 domenii BAC fixe: i, ii, iii, iv, v, vi, viii) × **`MAP_LAYOUTS`**
   (JSON precomputat în `src/lib/map/layouts/*.json`). NU interoghează deloc `concepts`
   pentru topologie — citește doar JSON-ul.
3. JSON-ul e produs de `scripts/etapa71/build-map-layouts.ts:60-63`, a cărui SINGURĂ
   sursă de noduri este:

```sql
SELECT module, concepts(id, slug, name, grade_level)
FROM concept_family_membership
LIMIT 2000;
```

   Apoi grupează pe `concept_family_membership.module` (mapat la cele 7 domenii BAC)
   și taie pe `grade_level`.

## CAUZA (dovadă numărată, Supabase)
`concept_family_membership` (sursa hărții) conține DOAR ~120 concepte, toate din cele
7 domenii BAC, puternic concentrate pe clasa 12:

| sursă | clasa 9 | clasa 10 | clasa 11 | clasa 12 |
|---|---:|---:|---:|---:|
| **concepts** (DB real) | 135 | 211 | **234** | 242 |
| **in concept_family_membership** (sursa hărții) | 0 | 7 | **1** | 112 |

→ Harta clasei 11 arată exact **1 nod** = singurul concept de clasa 11 aflat în
`concept_family_membership`. **Nu e lipsă de date** — cele 234 de concepte există în
`concepts`, dar nu ajung niciodată în hartă, fiindcă harta se construiește din graful
de familii (cele 7 domenii de BAC), nu din `concepts`.

## Coloana de grupare — de ce `module` singur nu ajunge
`concepts.module` e populat neuniform; `subtopic` are acoperire mult mai bună:

| clasa | concepte | module distinct | module NULL | subtopic distinct |
|---|---:|---:|---:|---:|
| 9 | 135 | **0** (toate NULL) | 135 | 99 |
| 10 | 211 | 23 | 65 | 104 |
| 11 | 234 | 20 | 113 | 94 |
| 12 | 242 | 15 | 151 | 84 |

Grupare robustă `COALESCE(NULLIF(module,''), NULLIF(subtopic,''), 'Altele')` → **0**
concepte în „Altele" (fiecare concept are măcar subtopic): grupuri 9→99, 10→58, 11→67, 12→74.

## Concluzie (ce trebuie reparat în FAZA B)
Mutarea sursei hărții de la `concept_family_membership` (7 domenii, ~120 concepte) la
**`concepts`** grupate robust pe `module ?? subtopic`, per clasă — ca fiecare clasă să
afișeze TOATE conceptele ei. Cele 113 concepte de clasa 11 fără `module` rămân vizibile
(grupate pe subtopic) și se raportează pentru un backfill de conținut ulterior (R5: nu inventăm module).
