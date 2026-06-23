# ETAPA 82 — Harta per clasă + onboarding de profil (review)

**Cerința structurală a ownerului:** elevul vede DOAR ce-i relevant clasei lui;
nu toți dau BAC. BAC-ul devine **mod**, nu cadru.

## Porți — stare

| Poartă | Probă | Stare |
|---|---|---|
| Build | `npm run build` | ✅ verde |
| Lint | `npx eslint` (0 erori) | ✅ verde |
| Teste unitare | `npm test` — **207** (din 189) | ✅ verde |
| Typecheck | `tsc --noEmit` (doar zgomot vechi `voice/__tests__`) | ✅ fără regres |
| POARTĂ A (profil) | migrație + onboarding pe fiecare goal | ✅ cod; live după migrație |
| POARTĂ B (hartă/clasă) | `etapa82-map-class` — clasa 10 = 7 noduri < 139 total; 10 ≠ 12; limbo 0 | ✅ verde |
| POARTĂ C (BAC ca mod) | `etapa82-goal-mode` — bac ≠ note_clasa; zero „BAC" la note_clasa/explorare | ✅ verde |
| POARTĂ D (paletă) | `etapa82-contrast` — toate perechile noi AA (14–18:1; AAA pe math) | ✅ verde |
| etapa70-contrast (regres) | toate perechile vechi AA | ✅ verde |
| Stress hartă (perf 72) | `etapa72-map-stress` — heap **7.1 → 6.6 → 7.0 MB** | ✅ verde |
| qa-crawl 0 erori | `etapa74-qa-crawl` — **ZERO** erori de consolă | ✅ verde |
| Screenshots | `etapa82-screens` — 19 imagini (desktop+mobil) | ✅ verde |
| Acceptanțe 60–81 (eșantion) | 60, 64, 68, 70-contrast, 71-map, 74-self-contained | ✅ verde |
| Migrații aplicate | goal + grade 9–12 + backfill (0 useri fără rând); lesson_canonical=opus-4-8 | ✅ live |

## Dovezi numărate

- **Harta per clasă** (din layout-urile precomputate, total graf = 139 noduri):
  - clasa 9 → **0** noduri (0 domenii) — empty-state onest + „Harta completă"
  - clasa 10 → **7** noduri (1 domeniu: iii)
  - clasa 11 → **1** nod (1 domeniu: iii)
  - clasa 12 → **131** noduri (7 domenii)
  - **limbo** (concepte fără clasă, NULL): **0** (toate au clasă atribuită)
- **BAC ca mod** (clasa 10): titlu „Drumul tău spre BAC" vs „Stăpânește clasa a 10-a"
  vs „Explorează matematica"; lentila BAC doar la goal=bac; explorare = hartă liberă.

## Migrație (de aplicat în Supabase)

`supabase/migrations/20260623000001_etapa82_goal_grade9.sql` — idempotentă:
`user_profiles.goal` (bac|note_clasa|explorare) + `grade_level` CHECK relaxat la 9–12
+ index parțial pe goal NULL.

## Checklist bucla vizuală (max 3 runde)

### Runda 1 — onboarding (desktop + mobil) ✅ capturat & verificat
- [x] **Welcome** neutru — „Tutorul AI de matematică pentru liceenii din Moldova",
  fără presupunerea BAC; fundal albastru-noapte (`--bg-night`), text deschis lizibil.
- [x] **Clasă (Pasul 1/3)** — 4 carduri tappable **9–12** (clasa a 9-a NOUĂ), pe brand.
- [x] **Obiectiv (Pasul 2/3)** — 3 carduri calde cu emoji: „Mă pregătesc de BAC" /
  „Vreau note mai bune la clasă" / „Explorez"; o întrebare pe ecran.
- [x] Mobil (390px) — carduri full-width, glife vii în fundal, bară de progres OK.
- Verdict rundă 1: fără defecte. (`onboarding-{welcome,grade,obiectiv}-{desktop,mobil}.png`)

### Runda 2 — hartă + moduri (desktop + mobil) ✅ capturat & verificat
- [x] **Harta clasa 10 vs 12** — vizibil diferite: clasa 12 = 7 domenii/constelație
  plină; clasa 10 = **1 domeniu, 7 teme**, mult mai curată. Antetul arată dovada
  numărată „Clasa 10: 7 teme · 139 în tot graf".
- [x] **Comutator** 9–12 (clasa ta inelată) + **„Harta completă"** → „Doar clasa mea",
  toate cele 7 domenii revin, antet „Harta completă · 139 teme".
- [x] **Cont `note_clasa`** — titlu „Stăpânește clasa a 10-a", **lentila BAC dispărută**
  (doar Nota-țintă + Test mâine); azi fără limbaj de BAC. **Zero** „BAC".
- [x] Fundal albastru-profund (`--bg-deep`) pe hartă, `--bg-night` pe onboarding;
  text deschis lizibil (contrast AA verificat de `etapa82-contrast`).
- [x] **Confirmarea A3** — „Bun venit înapoi 👋 / Hai să-ți potrivim aplicația",
  pills 9–12 + 3 carduri obiectiv + skip sigur.
- Verdict rundă 2: fără defecte. (`harta-*`, `azi-*`, `onboarding-confirma-desktop.png`)

### Review advers (workflow, 4 dimensiuni)
- 2 descoperiri reale (verificate), reparate: HIGH (upsert + backfill anti-lockout),
  LOW (sync domainKey). 2 false respinse. Vezi commit `633e1ff`.
