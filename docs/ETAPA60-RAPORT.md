# ETAPA 60 — BUCLA ELEVULUI, PARTEA 1 (2026-06-09)

## EȘECURILE ȘI GOLURILE ÎNTÂI

1. **Zgomotul linkurilor contaminează frontiera (defect cunoscut din ETAPA 57, acum VIZIBIL în produs).** Testul de acceptare a scos în frontieră `g10-modulul-numarului-real` cu „113 exerciții verificate" — dar exercițiile servite pe el sunt INTEGRALE (Modulul II), nu modul: `exercise_concept_link` e top-K embedding (median 9/exercițiu), nu curare semantică. Porțile țin (se servesc DOAR exerciții verificate), dar **relevanța exercițiu↔concept e slabă**. Remediere = re-linkarea curată (etapă viitoare, deja diagnosticată în ETAPA 57).
2. **0/19 figuri legate stau pe exerciții verificate** (query: `figuri_pe_exercitii_verificate = 0`). Figurile acceptate vin din Module V–VI (geometrie), verificarea CAS există doar pe Module I–II (analiză). Calea figură→chat e completă structural (`has_figure` + `/api/figura/[id]` + markdown img în primul mesaj), dar **nu se aprinde** până nu există verificare pe geometrie. Gol de conținut, pe clase: geometria (Module V–VI, ~390 exerciții) = 0 verificate.
3. **11/30 figuri acceptate NELEGATE de exerciții** (match exact unic doar pentru 19; 0 ambigue). Cele 11 sunt probe făcute manual + condiții editate — rămân `exercise_id NULL`, marcate, neforțate.
4. **Evidența din chat NU modifică mastery** (decizie onestă, nu lipsă): corectitudinea încercării elevului în chat nu e evaluată de nimeni încă → `correct=null` ⇒ doar `evidence_count`/`last_evidence_at`/`source='chat'`. Evaluarea încercărilor (CAS sau LLM-grader) = etapă viitoare; orice altceva ar fi fost mastery fabricat.
5. **Direcția muchiilor contrazice mandatul**: mandatul zicea „prerechizite = incoming"; datele arată `from_concept`=dependent → `to_concept`=prerechizit (ex. `g10-modulul-numarului-real → g8-modulul-unui-numar-real`). Am urmat DATELE, documentat în funcția SQL.
6. **Topice NEMAPATE: 0** — toate cele 22 au avut potriviri clare în graf. Atenție însă la 5 mapări cross-grade (siruri g10→concepte g11, polinoame g11→g12, ecuatii/inecuatii_log_exp g11→g10, matrici+complexe g12→g11, combinatorica g12→g10) — listate în antetul fișierului pentru **revizuirea umană a lui Maxim** (`src/lib/diagnostic/topic-concept-map.ts`).
7. **Frontiera conține concepte cu mastery 0.3 și exerciții irelevante semantic** (vezi #1); pagina „Azi" e reală dar calitatea recomandării e plafonată de calitatea linkurilor.

## Per pas

| Pas | Ce s-a construit | Dovadă | Commit |
|---|---|---|---|
| 1 | `concept_mastery` (PK user+concept, mastery 0..1 CHECK, evidence_count, source[], RLS user-owned strict + service_role; index); `topic_mastery` DEPRECATED (COMMENT în DB + scrierea din onboarding eliminată) | migrația `20260616000003` aplicată; tabel viu folosit de toate pașii următori | `d1025b6` |
| 2 | Mapare 22 topice → 52 slug-uri reale (fișier cu antet REVIZUIRE UMANĂ + tabel); poarta `verify:topic-map` (slug inexistent/topic neacoperit = exit 1); EMA α=0.3 documentată; `diagnostic/submit` scrie evidență | rulare poartă: `52/52 slug-uri există, 22/22 topice acoperite, exit 0`; anti-join SQL la autorare: 0 inexistente | `244942e` |
| 3 | `frontier_concepts(user, grade, limit)` cu presupunerea documentată (clase ≤ grade−3 fără evidență = știute, aplicată consecvent); EXECUTE doar service_role; fix GRANT-uri (default privileges sparte pe tabele noi — service_role fără DML!) | test cu ASSERT pe user sintetic creat+șters: X (prereq 0.7) ÎN frontieră, Y (un prereq 0.2) EXCLUS, Z (mastery 0.7) EXCLUS, invariante pe toate cele 132 rânduri + ordonare → exit 0 | `2e00f6a` |
| 4 | `/app/azi` server component (zero LLM): 5 carduri din frontieră cu nume/clasă/№ exerciții verificate/„de ce" (prerechizite ✓ cu nume)/buton Învață → `/app/chat?concept=`; empty state → diagnostic; link „Azi" în sidebar | build: ruta `/app/azi` generată; cod | `2c5bd71` |
| 5 | Chat ancorat: `?concept=` → primul mesaj asistent = template determinist (teorie 600 chars + primul exercițiu VERIFICAT + figura dacă există); `/api/chat` injectează teoria (≤2000) + exercițiile verificate în system prompt; evidență source=chat (expunere, mastery neatins — vezi Eșec #4) | cod + build; acceptarea de mai jos folosește exact `getConceptAnchor` | `c2d8254` |
| 6 | `figura_autor.exercise_id` + match text normalizat (19 legate / 0 ambigue / 11 nelegate); `GET /api/figura/[exerciseId]` (auth, doar acceptate, SVG randat server din `spec_generat`, cache privat 24h); figura în primul mesaj din chat-concept | query post-migrație: `legate=19, nelegate=11`; explorare pre-persistare în raport | `c284f16` |

## Testul de acceptare cap-coadă (repetabil: `npx tsx --env-file=.env.local scripts/verify/etapa60-acceptance.ts`)

User REAL de audit: `etapa60-acceptance@test.local` (id `0426b9c2-b591-480e-aa3f-e6a0864099a9`), **păstrat în DB** cu rândurile lui.

1. **6 răspunsuri diagnostic** (primitive ✓✓, integrale ✗, geometrie_3d ✓, probabilitati ✗, combinatorica ✓) prin ACELAȘI cod ca `/api/diagnostic/submit` → **14 rânduri** în `concept_mastery`.
2. **Matematica EMA verificată pe rezultat**: 2 corecte → 0.510 (= 0.3 + 0.3·0.7); 1 corect → 0.300; greșit → 0.000. Exact formula documentată.
3. **Frontiera lui** (top 5): `g10-modulul-numarului-real` (113 ex.v.), `g10-functia-de-gradul-ii` (43), `g10-aria-figurii-plane` (1), `g10-functia-de-gradul-i` (1), `g12-volumul-unui-corp-geometric` (mastery 0.30, 7 ex.v., prereq 1/1).
4. **Exercițiile servite pe primul concept** (doar verificate): 2 integrale din Modulul II (id-uri în output) — relevanța slabă = Eșec #1.
5. **Figura**: 0 pe aceste exerciții (= Eșec #2, dovadă query `figuri_pe_exercitii_verificate = 0`).

Repetabil de un auditor extern: scriptul resetează mastery-ul userului de test și rulează identic.

## Verificare finală

- `npm run build` → **exit 0** (rute noi: `/app/azi`, `/api/figura/[exerciseId]`)
- `npx eslint . --quiet` → **exit 0**
- `npm test` → **21/21**
- `npm run verify:topic-map` → exit 0 (52/52, 22/22)
- `scripts/verify/frontier-test.ts` → exit 0 (toate aserțiunile)
