# STARE PRODUS — după maratoanele ETAPELE 62–65 + 66 (10 iunie 2026)

## ETAPA 66 — cost & performanță (tabelul-rege, baseline → după)

| Metrică | Baseline (MĂSURAT) | După | Δ | Statut |
|---|---|---|---|---|
| Cost/mesaj premium (conversație) | $0.0274 | $0.0079 (cache 83–99% din input) | **−71%** | MĂSURAT (etapa66-cache-test) |
| Cost/mesaj free | $0.0086 | $0.0086 (conv. scurte) | 0% | MĂSURAT — Haiku 4.5 sub minimul cache-abil (4096 tok, empiric); prefixul va crește natural cu contractul ETAPA 67 |
| Istoric tokeni (mesajul 15) | 12 629 | 6 502 (rezumat persistat + 6 integrale) | **−49%** | MĂSURAT (countTokens) |
| Cost TTS/enunț repetat | $0.001725 | $0 (hit Storage) · test 20 redări: −50% | →0 pe conținut repetat | MĂSURAT (10/10 hit runda 2) |
| Latență TTS pe hit | 3212 ms | 631 ms | **−80%** | MĂSURAT |
| Randări KaTeX (mesaj 8 blocuri, 40 chunks) | ≈320 echiv. | 8 | **−97%** | MĂSURAT (contor în test jsdom) |
| Landing `/` | ƒ dynamic | ○ static | — | MĂSURAT (build output) |
| TTFB chat | 1.6–1.8 s | similar (ne-remăsurat sistematic) | — | MARCAT: nemăsurat după |
| Dimensiune cache TTS la 1000 enunțuri | — | ~130 MB | — | ESTIMAT (extrapolare din 133 KB/fișier măsurat) |

Garduri active: buget lunar per tier (downgrade politicos la Haiku), kill-switch global,
alertă cost zilnic cu banner în /admin/metrics (p50/p95, rate cache, cost/zi, top useri).
Instrumentare: fiecare apel LLM/TTS/embedding scrie tokens+cache+latență în api_usage_log.

---

# Maratonul ETAPELE 62–65

Document scurt de stare: ce e live, ce e marcat onest, ce lipsește.
Detaliile per etapă sunt în mesajele de commit (prefix `ETAPA <N>:`).

## Ce e live (funcțional, cu dovezi)

| Capabilitate | Etapa | Dovadă |
|---|---|---|
| KaTeX peste tot: diagnostic (prompt + variante A–D), first-lesson, /app/azi, MiniChat — prin `MathText` (doar math dintre delimitatori; fallback text brut) | 62 | `tests/content/segment-delimited.test.ts` (7 teste) |
| Evaluarea răspunsurilor în chat-ul ancorat: Nivel A determinist (mathjs, doar linkuri `strict-bijectiv`) → Nivel B judecător Haiku (`judge_answer`, conf < 0.8 nu mișcă mastery); EMA α=0.3; feedback discret în UI | 63 | `scripts/verify/etapa63-acceptance.ts` EXIT=0 |
| Două niveluri de servire: `verificat` (CAS) > `sursa-oficiala` (răspuns oficial, link neambiguu), view `exercise_servable`; etichetă vizibilă „din culegerea oficială BAC"; figurile legate se servesc prin `/api/figura` | 64 | `scripts/verify/etapa64-acceptance.ts` EXIT=0 |
| Daily challenge determinist (seed user+dată, 1–3 exerciții servibile de pe frontieră) + streak server-side (`streak_log`); card pe /app/azi + flacără în header | 14 | `scripts/verify/etapa14-acceptance.ts` EXIT=0 |

## Cifrele care contează (DB live, 10 iunie 2026)

- exerciții servibile: **345 → 423** (tier verificat 345 + sursă-oficială 78)
- concepte cu conținut servibil: **17 → 51**
- module cu conținut: I–II → **I–VII** (III: 2, IV: 11, V: 30, VI: 12, VII: 12); **VIII rămâne 0**
- linkuri exercițiu↔răspuns de încredere: **91** (`strict-bijectiv`, bijective pe sursă+secțiune+număr)
- linkuri exercițiu↔concept: 2300 (ETAPA 61); orfani: 281

## Marcat onest (limite cunoscute)

1. **Figurile: 1/19 aprinse.** Doar `b47-033-f6eb97ce` e legată de un exercițiu servibil.
   Celelalte 18 figuri sunt legate de exerciții fără verificare CAS și fără răspuns oficial
   prin link strict. E gol de DATE (linkare răspunsuri), nu de cod — mecanismul servirii
   figurilor funcționează (dovedit în etapa64-acceptance).
2. **Linkurile istorice exercițiu↔răspuns (276: 39 'exact' + 237 'fuzzy') sunt nesigure**
   — eșantion: 3–4 din 5 'exact' vizibil greșite. Rămân în DB ca istorie; nimic în afară
   de `strict-bijectiv` nu e folosit la evaluare/servire.
3. **Modulul VIII: 0 exerciții servibile** (fără CAS, fără secțiuni potrivibile la răspunsuri).
4. **Diagnosticul (327 exerciții) folosește Unicode, nu LaTeX** — MathText e cuplat, dar
   nu are ce randa până nu se regenerează pool-ul cu delimitatori KaTeX (decizie umană).
5. **Judecătorul (Nivel B)** e nedeterminist prin natură: verdictele sub confidence 0.8
   sunt onest `null` (doar expunere, mastery neatins).

## Ce lipsește (etape viitoare, ne-începute deliberat)

- notificări + recompense pentru streak (scop strâmt ETAPA 14 — excluse explicit)
- extinderea linkării răspunsurilor oficiale (mai multe secțiuni potrivibile → mai multe
  exerciții sursă-oficială, mai multe figuri aprinse)
- figurile eșec-concept (82) — NEATINSE (regula R6)
- exercițiile diagnostic nevalidate — decizie umană, NEATINSE (R6)

## Userul de audit

`etapa60-acceptance@test.local` (id `0426b9c2-…`) — păstrat în DB cu mastery, încercări,
daily-uri sintetice (1–4 iunie 2026) și streak_log ca artefact reproductibil al scripturilor
de acceptanță. Scripturile se pot re-rula oricând (își resetează singure datele).
