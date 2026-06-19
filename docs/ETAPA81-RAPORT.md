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
| D2 — regenerare canonice v2 | ✅ executat | model→Opus 4.8 (migrație); **47/52 concepte v2 cu bloc interactiv**; cost real **$19.99** (avg $0.21/apel) |
| D3 — render-audit v2 | ✅ verde | **0 scurgeri** pe servit (lecții-canonice 0/52, servabile 0/418, simulare 0/87) |
| E — live interactiv | ✅ livrat | LESSON_SYSTEM_PROMPT mandatează interactivul (chat liber NEATINS) |
| F — screencast + porți | ✅ executat | slider/tabel/zar/try_step/comutator în lecție REALĂ v2, desktop+mobil |

## Execuție D2/D3/F (model deblocat → Opus 4.8)
- **Migrație** `20260619000001`: `ai_model_config.lesson_canonical` → `claude-opus-4-8` (fără drift).
- **D2** — regenerare în 2 valuri + reparații (eșecuri-întâi):
  - sanity 5/5 ($0.99) → a prins o scurgere într-o `variante` → am transformat asta într-o
    POARTĂ FERMĂ (validateCanonicalBlocks respinge math brut în orice câmp, reutilizând
    detectorul calibrat din body-render);
  - lot complet: 44 generate clean, 7 eșecuri (5 trunchiere „nu e array JSON" pe concepte
    complexe de statistică/geometrie la 32K tokeni + 2 respinse de poarta de scurgere);
  - retry: +2 recuperate; reparație mecanică R5-sigură (strip `$` din câmpurile `formula`
    pre-delimitate de model, care dădeau `$$$…$$$`) + regenerare țintită → metoda-integrarii curat;
  - FINAL: **47/52 concepte v2 (toate cu ≥1 bloc interactiv)**; 5 rămân pe versiunea veche
    CURATĂ (generarea v2 a eșuat la trunchiere/scurgere repetată) — render OK, doar fără interactiv.
  - cost real total: **$19.99** / 94 apeluri (estimare $20-25 — în țintă).
- **D3**: render-audit pe SERVIT (ultima versiune per concept) — extins să traverseze textul
  blocurilor interactive (caption/cells/observe/prompt/hint/variante): **0 scurgeri**.
  _(figuri-teorie 14/45 = corpuri de teorie ale CONCEPTELOR, problemă pre-existentă ETAPA 79,
  în afara scopului lecțiilor v2.)_
- **F**: `docs/design-review/etapa81/` — slider mișcat (+observabile), tabel pe pași, zar aruncat
  (sumă), try_step, comutator Simplu↔Riguros, pe `g12-elemente-de-calcul-financiar` +
  `g12-probabilitate-conditionata`, desktop + mobil.

## Cele 5 concepte rămase pe versiune veche (pentru Maxim)
g11-formula-binomului-lui-newton, g12-media-aritmetica-a-seriei-statistice,
g12-sfere-inscrise-si-circumscrise-poliedrelor-si-cilindrului,
g12-gruparea-datelor-pe-intervale-de-variatie (+1) — trunchiere la 32K / scurgere repetată.
Se recuperează cu max_tokens mai mare sau o repetare ulterioară; versiunile vechi servite sunt curate.

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
