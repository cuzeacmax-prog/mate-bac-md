# ETAPA 81 — RAPORT: studiu interactiv + vocabular adaptiv

_Reguli R1-R5 respectate (R5: AI cere vizualuri cu parametri validați; motoarele
deterministe randează; AI nu desenează). Eșecuri-întâi, commit per fază, porți._

## Stare pe faze

| Fază | Stare | Dovadă |
|---|---|---|
| A — contract blocuri v2 | ✅ livrat | 5 tipuri interactive + vocab, 14 teste |
| B — playerul interactiv | ✅ livrat | 5 componente + endpoint /try, 9 teste logică, POARTĂ B (build) verde |
| C — vocabular adaptiv | ✅ livrat | mastery→registru + comutator, 12 teste, POARTĂ C verde |
| D1 — mandat generator v2 | ✅ livrat | CANONICAL_ADDENDUM + validateCanonicalBlocks extins (build verde) |
| D2 — regenerare 87 canonice | ⏸ blocat | model configurat `claude-fable-5` → 404 în acest mediu („use Opus 4.8") |
| E — live interactiv | ✅ livrat | LESSON_SYSTEM_PROMPT mandatează interactivul (chat liber NEATINS) |
| F — porți | ✅ verde | 189 teste · build OK · render-audit 0 scurgeri |

## A — Contract de blocuri v2 (`src/lib/lesson/blocks.ts`)
5 blocuri noi cu limite ÎN SCHEMĂ (invalid → respins, recerut):
`reveal_figure` (straturi pe pași), `progressive_table` (celulă-cu-celulă),
`interactive_manipulative` (subset tactil), `parameter_slider` (refine: param∈expr,
min<max, step>0), `try_step` (expected stripat la client, ca quiz-ul). `vocab_level` +
`variante` co-generate pe intro/step.

## B — Playerul interactiv
- `interactive.ts` (logică pură testabilă) + `InteractiveBlocks.tsx` (5 componente client,
  mobile-first, reduced-motion, accesibile): slider re-randează plot determinist (debounced,
  observabile rădăcini/vârf), zar aruncabil, urnă cu P actualizată, persoane drag-reorder,
  tabel/figure pe pași, try_step cu verificare server + hint.
- `/api/lesson/try`: verificare determinist (compareAnswers, ETAPA 63); mastery ½ cu hint /
  plin curat (ETAPA 70-D); greșit nu penalizează (formativ). `expected` stripat în AMBELE
  bucle de stream (canonic+live) → nu pleacă la client.

## C — Vocabular adaptiv
- C1: `masteryToRegister` — praguri documentate (<0.3 comun / [0.3,0.6) punte / ≥0.6 barem).
- C2: regula fermă a PUNȚII progresive în prompt (prima apariție a termenului strict = comun +
  definiție în paranteză; ulterior = direct).
- C3: comutator Simplu/Punte/Riguros în player (default din mastery, override localStorage);
  intro/step își schimbă proza prin variante co-generate FĂRĂ re-LLM; matematica neatinsă.
- POARTĂ C: 3 niveluri mastery → 3 registre distincte; comutarea schimbă proza, nu math.

## D — Generator v2
- D1: mandatul v2 în `CANONICAL_ADDENDUM` (interactiv unde conceptul permite + co-generarea
  variantelor de vocabular); `validateCanonicalBlocks` validează randabilitatea blocurilor
  interactive și le numără în mandatul de vizual. Poarta respinge lecția fără interactiv unde
  e disponibil. **Gata de rulat.**
- D2: regenerarea celor 87 + render-audit pe v2 — BLOCATĂ: modelul activ pentru `lesson_canonical`
  (`claude-fable-5`) întoarce 404 în acest mediu (API: „use Opus 4.8"). NU am suprascris
  alegerea de model a lui Maxim și nu am cheltuit bugetul (~$20-25) nesupravegheat. Se rulează
  cu `GEN_LIMIT`/`FORCE`/`REGEN_BEFORE` odată ce modelul configurat e disponibil.

## E — Live
`LESSON_SYSTEM_PROMPT` (calea de lecție block-based: start live + ask) mandatează interactivul
pe tip de concept. `/api/chat` (chatul liber) rămâne markdown, NEATINS (SIGURANȚĂ).

## F — Porți (la final)
- 189 teste vitest verzi (35 noi: A 14 + B 9 + C 12).
- build de producție: Compiled successfully.
- render-audit pe tot ce se servește: **0 scurgeri** (servabile 0/418, lecții-canonice 0/87,
  simulare 0/87, provocări 0/14).
- Screencast-ul interactivului în lecție reală depinde de D2 (lecții v2 generate) — rămâne după
  deblocarea modelului. Componentele sunt verificate prin build + testele de logică.

## Ce rămâne pentru Maxim
1. Deblochează modelul `lesson_canonical` (Fable 5 indisponibil aici → Opus 4.8), apoi rulează
   regenerarea v2 (D2) + render-audit pe v2 (D3) + screencast-urile (F).
2. Player-ul vechi rămâne fallback; noul interactiv e activ pentru orice lecție care emite
   blocurile v2.
