# ETAPA 77 FAZA G — porțile finale (raport onest, eșecurile primele)

Rulare: 2026-06-11, secvențial, guard-test ULTIMUL. Log brut: `porti-finale-log.txt`.

## EȘECURI (7) — toate cu cauză externă sau documentată, ZERO regresii de cod

### 1 cauză comună pentru 6 eșecuri: creditul API Anthropic s-a EPUIZAT în timpul bateriei

Dovadă (re-rulare individuală `etapa70-figures-acceptance`):

```
"Your credit balance is too low to access the Anthropic API.
 Please go to Plans & Billing to upgrade or purchase credits."
```

| Poartă | Simptom | De ce e creditul, nu codul |
|---|---|---|
| etapa69-acceptance | scor 3≠5 | 3/5 au trecut, apoi apelurile au murit mid-test |
| etapa70-ask-acceptance | 0 blocuri valide | apel LLM live → 400 credit |
| etapa70-figures-acceptance | fără figure kind=theory | re-rulat individual: eroarea de credit de mai sus |
| etapa71-manipulative-acceptance | fără manipulativ | apel LLM live → 400 credit |
| etapa75-cache-proof | conversationId lipsește | stream-ul de chat a murit la primul apel |
| etapa77-visual-live | niciun bloc vizual | ACEEAȘI poartă a trecut azi-dimineață (B3 ✅) cu credit |
| etapa66-guard-test | premium nedowngradat | mesajul de test n-a putut rula deloc |

**Dovada că nu e regresie:** B3 (visual-live) și F4 (foto, 6 poze cu vision) au trecut
azi în aceeași zi de lucru, înainte de epuizare; cele 22 porți deterministe (mai jos)
sunt toate verzi; qa-crawl = zero erori de consolă pe toate fluxurile.

**Acțiune:** după reîncărcarea creditului Anthropic se re-rulează:
`etapa69`, `etapa70-ask`, `etapa70-figures`, `etapa71-manipulative`,
`etapa75-cache-proof`, `etapa77-visual-live`, apoi `etapa66-guard-test` (ultimul).

**Incident colateral reparat:** guard-test a picat ÎNAINTE să-și restaureze configul →
`cost_budget_usd.premium` rămăsese `0.000001`. Restaurat manual prin SQL la
`{free:1, premium:10, family:15}`; `llm_kill_switch=false` verificat.

### 2. etapa74-render-audit: 14 scurgeri — TOATE pe figuri-teorie (cunoscute, R5)

Cele 14 body-uri de teorie cu proză-unicode sunt pe lista `body_latex_issues`
(pipeline-ul uman din etapa 72, regula R5: nu rescriem matematica cu LLM-ul).
Pe conținutul SERVIT (servabile, lecții canonice ×79, provocări, simulare): **0 scurgeri**.

### 3. TTS top-up (281 fișiere noi din regenerarea B): 164/164 EȘUATE — cota OpenAI

`OpenAI 429: You exceeded your current quota` — limită de facturare OpenAI, nu cod.
Lecțiile regenerate nu au TTS pre-generat; la cerere va folosi același pipeline cu cache
după reîncărcare. Re-rulare: `npx tsx --env-file=.env.local scripts/etapa75/pregen-tts.ts`.

## VERZI (24)

- 22 porți acceptanță 60–75 deterministe/DB/UI: 60, 63, 64, 66-cache, 66-diet,
  66-tts-cache, 67-language, 67-lesson-smoke, 68, 70-g, 70-help, 70-mistake,
  71-map, 71-payments, 72-latex, 72-messages, 72-map-stress (heap 7.0→6.5→6.9 MB),
  73-markdown, 74-qa-crawl (ZERO erori consolă), 75-canonical-validate,
  75-canonical-acceptance ($0.0267→$0.0000/lecție), 75-routing
- contrast: toate perechile WCAG ✅
- visual-gate: toate clasele de defect prinse și auto-reparate ✅
- vitest: 126/126 · lint: 0 erori (14 warnings preexistente) · build ✅

## Dovezile vizuale FAZA G

- `coregrafia.webm` — screencast azi→harta→foto→lecție (tranzițiile 220ms + loaderele de brand)
- landing pe 3 viewport-uri, lecția-scenă intro+vizual desktop/mobil, foto-start
- `foto-test/` — cele 6 poze sintetice din acceptanța F4 (trecută cu credit: 3 corecte,
  2 parțiale, refuzul non-math corect)
