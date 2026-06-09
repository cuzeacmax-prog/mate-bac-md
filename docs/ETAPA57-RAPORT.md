# ETAPA 57 — AUDIT TOTAL CU DOVEZI + REMEDIERE (2026-06-09)

Regula de citire: fiecare număr de mai jos are dovada lângă el (query + rezultat, fișier:linie, sau comandă + exit code). Eșecurile și necunoscutele primele.

---

## 1. DEFECTE CRITICE găsite

### D1 — CRITIC, REPARAT: RLS efectiv anulat pe 5 tabele (graf + diagnostic)
**Dovadă:** `pg_policies` arăta politicile „Service role manages …" cu `roles={public}, cmd=ALL, qual=true` pe `concepts`, `concept_edges`, `diagnostic_exercises`, `exercises`, `exercise_concepts`. Numele politicii zicea „service role", realitatea era **orice rol** — politica anula RLS pe tabele care țin 1 606 concepte + 3 229 muchii + 327 exerciții diagnostic.
**Atenuare preexistentă:** `role_table_grants` nu dădea INSERT/UPDATE/DELETE către anon/authenticated → neexploatabil prin REST pentru scriere, dar o singură funcție SECURITY INVOKER viitoare ar fi deschis ușa.
**Reparat:** migrația `etapa57_security_hardening` (repo: `supabase/migrations/20260616000000_…`, commit `3c04383`) — politici re-scopate `TO service_role`.
**Verificare post-fix:** `politici_all_public_ramase = 0` (query pe pg_policies).

### D2 — CRITIC, REPARAT: TRUNCATE (ne-supus RLS) acordat rolurilor API pe toate cele 51 de tabele
**Dovadă:** `role_table_grants`: anon și authenticated aveau `TRUNCATE, TRIGGER, REFERENCES` pe **51/51** tabele public (inclusiv profiles, messages, subscriptions). TRUNCATE ocolește RLS complet.
**Reparat:** aceeași migrație — `REVOKE … ON ALL TABLES` + `ALTER DEFAULT PRIVILEGES`.
**Verificare post-fix:** `granturi_periculoase_ramase = 0`.

### D3 — REPARAT: 16 funcții cu search_path mutabil + 4 SECURITY DEFINER executabile de anon
**Dovadă:** advisors security: 31 de constatări înainte de fix.
**Reparat:** `SET search_path = public, pg_temp` pe toate; `REVOKE EXECUTE` pe `handle_new_user`/`rls_auto_enable` (funcții de trigger, nu API) de la anon+authenticated; rate-limit revocate doar de la anon (chat-ul le apelează cu sesiune autentificată — `src/app/api/chat/route.ts:117`).
**Verificare post-fix:** advisors security **31 → 6**; cele 6 rămase: `documents` fără politici (= deny-by-default, intenționat), `email_list` INSERT public (signup newsletter, cerut de produs), rate-limit executabile de authenticated (cerut de produs, ×2), leaked-password-protection (setare dashboard Auth — **nu se poate din SQL, de bifat manual**).

### D4 — REPARAT: lint eșua cu 45 de erori (build-ul era verde, lint nu)
**Dovadă:** `npx eslint . --quiet` → exit 1, 45 erori (15 în bundle-ul vendored tikzjax, 7 `no-explicit-any`, 6 `require()`, 7 `prefer-const`, 8 react-hooks, 2 entities).
**Reparat:** commit `4ae266e`. Post-fix: `eslint . --quiet` → **exit 0**; `npm run build` → **exit 0** (63 pagini); `npm test` → **21/21**.

### D5 — REPARAT (onest): 13 figuri acceptate cu `gates.reproduced` NULL
**Dovadă:** query pe `figura_autor`: 13 rânduri acceptate fără `reproduced`.
**Cauză reală:** toate 13 sunt pe calea **relation** (Calea B din `process-concepts.ts:82`), care prin design nu produce `reproduced` (nu există problemă rezolvabilă CAS, doar construcție de relație + poartă vizuală).
**Acțiune:** re-procesate țintit prin pipeline-ul ETAPA 56 complet (filtru `--doar=`, commit `28f2af2`). Rezultat onest: toate 13 rămân pe calea relation, **visual_ok 13/13, render_png 13/13, reproduced inexistent prin design** — adică aceste 13 figuri NU au reproducere numerică a datelor, doar poartă vizuală. Nu s-a forțat nimic.

### D6 — MARCAT (benign): coliziunea render_hash `f046cd38…` (3 figuri, 2 condiții)
**Dovadă:** query coliziuni + `md5(condition)`: `con-sectiune-plan-paralel` și `proba-con-sectiune-web` au condiție **identică** (md5 `5df30da2…`) — probă de test web duplicată; a treia (`intr-un-con-…-mpwe893i`) are altă formulare dar **aceleași date matematice** (h=6, V=18π, plan la d=2 de vârf) → același desen e comportamentul corect, nu șablon.
**Acțiune:** duplicatul marcat în `remarci` (etapa 57, tip `duplicat-proba-test` / `coliziune-hash-benigna`) — persistat în DB. Figuri distincte reale: **111, nu 112**.

### Marcate, NEREPARATE (cu cauză):
| Defect | Dovadă | De ce nu acum |
|---|---|---|
| 867/1268 exerciții fără NICIO verificare (Module III–VIII = 0%) | query exercise_raw×exercise_verification | volum de conținut, nu bug; necesită extinderea verificatoarelor CAS pe module noi |
| 55 verificări FAIL + 20 neconcludente (verified NULL, 19 cas_sympy_integral) | query exercise_verification | FAIL-urile sunt starea onestă; forțarea lor = exact boala interzisă de R3 |
| 327 exerciții diagnostic cu 0 verificări | query: `verificari_in_ev = 0` | decizie strategică separată (exclus explicit din B) |
| Linkuri exercițiu–concept = zgomot top-K | min 6 / median 9 / max 9; 1197/1268 cu >6 | re-linkarea e muncă de fond (ETAPĂ separată); azi doar diagnosticat |
| 82 figuri esec-concept | query figura_autor | starea corectă, păstrată intenționat |
| Leaked password protection dezactivat | advisor WARN | setare Auth din dashboard, inaccesibilă prin SQL/MCP |
| 2 concepte orfane (`g11-alfabetul-grec`, `g4-supliment-artistic`) | query anti-join concept_edges | ambele sunt non-matematice (artefacte de extracție); ștergerea = decizie de conținut, nu de audit |
| npm audit: 3 moderate (hono ×4 advisories, postcss via next) | `npm audit` | scope-ul B4 = doar high/critical → **zero high/critical** |

---

## 2. Tabel sănătate per componentă (numere, nu adjective)

| Componentă | Număr-dovadă |
|---|---|
| Graf concepte | 1 606 concepte; 1 527 cu body >100 chars (95,1%); 2 orfane; 3 229 muchii; **0 cicluri** (închidere tranzitivă completă: `noduri_in_cicluri = 0`) |
| Exerciții | 1 268 în exercise_raw; 377 cu ≥1 verificare (29,7%); 585 pass / 55 fail / 20 neconcludente din 660 verificări; Module III–VIII: **0 verificate** |
| Linkuri ex–concept | 11 199 linkuri; min 6 / median 9 / max 9 per exercițiu — distribuție de top-K embedding, NU curare semantică; 1 197/1 268 peste pragul 6 |
| Figuri | 112 rânduri = **111 distincte** (1 duplicat marcat); 30 acceptate (17 concept cu reproduced + 13 relation doar-vizual) / 82 esec-concept; coliziuni hash între condiții diferite: 1, benignă |
| Diagnostic | 327 exerciții, 327 cu explicație, 0 fără răspuns, **0 verificări** |
| Cod | build exit 0 (63 pagini); lint exit 0 (după fix 45→0); test 21/21; npm audit high/critical: 0 (moderate: 3) |
| Securitate | advisors 31 → 6 (toate 6 justificate/dashboard); politici ALL-to-public: 5 → 0; granturi TRUNCATE către roluri API: 51 tabele → 0; secrete hardcodate: **0** (grep JWT/sk-ant/sk-proj pe tot repo: no matches) |

---

## 3. Meta-audit A3 — porțile mint? (5 figuri alese determinist: sort md5(slug||'etapa57'), NU cherry-pick)

Script persistat: `scripts/figures/audit57.ts`. Rezultate brute:

| Figură | hash stocat vs re-randat din spec_generat persistat | reproduced stocat vs re-măsurat |
|---|---|---|
| b47-045-9c7b8308 (concept) | `caa3d655…` = `caa3d655…` ✓ | 2 = 2 ✓ (\|AB\|=6→măsurat 6.000000; \|VO\|=3→3.000000) |
| b47-046-d3a21d99 (concept) | `59173c7e…` = `59173c7e…` ✓ | 2 = 2 ✓ (\|AB\|=25.4558…→măsurat 25.455844; \|VA\|=45→45.000000) |
| proba-con-sectiune-web (relation) | `f046cd38…` = `f046cd38…` ✓ | n/a (relation nu are reproduced) |
| baza-piramidei-…-mpwpu4k2 (relation) | `db2373c2…` = `db2373c2…` ✓ | n/a |
| b47-070-301f4e94 (concept) | `9e7359a1…` = `9e7359a1…` ✓ | 2 = 2 ✓ (\|AB\|=8→8.000000; \|AA1\|=8→8.000000) |

**Concluzie:** 5/5 identice; `reproduced N` = N măsurători geometrice reale (`Check {name, pass, detail:"măsurat …"}`, `src/lib/figures/cas.ts:290,312,604`), nu contor. **Limita onestă:** pe cele 13 figuri relation, `reproduced` nu există deloc — acolo poarta numerică nu minte, ci lipsește.

---

## 4. Inventar A4 — bucla produsului (ce EXISTĂ vs ce LIPSEȘTE)

**Există în traseul elevului (fișier:linie):**
- Diagnostic: `/api/diagnostic/start|next|submit` → `diagnostic_sessions` + `diagnostic_exercises` (`src/app/api/diagnostic/submit/route.ts:60,74,105`; `next/route.ts:133`)
- Chat Study/Solve: `match_exercises` RPC pe biblioteca solved_exercises (`src/app/api/chat/route.ts:49`), `match_solution_methods` (`src/lib/rag/solution-methods.ts:77`), gap_analysis (`route.ts:477`)

**LIPSEȘTE complet din traseul elevului (referit doar din /admin sau scripturi):**
- `concepts` → doar `src/app/admin/graf/page.tsx:42,62`
- `concept_edges` → **nicio referință în src/** (doar scripturi) — traseul din graf nu există în produs
- `exercise_raw` → **nicio referință în src/**
- `exercise_verification` → doar `src/app/admin/verificare/page.tsx:16` + API admin — Study/Solve NU o folosește
- `exercise_concept_link` → **nicio referință în src/**
- `figura_autor` → doar admin (`src/app/admin/figura-autor/page.tsx:12`)
- Diagnosticul scrie doar în `diagnostic_sessions`; **nu atinge** `topic_mastery`/`progress`/graful

Nimic construit azi (conform mandatului) — doar inventariat.

---

## 5. Ce NU am putut verifica și de ce

1. **Chat-ul live după revoke-uri** — verificarea statică arată că authenticated păstrează EXECUTE pe rate-limit și service_role pe restul, dar nu am rulat un flux de chat real cu utilizator autentificat în această sesiune.
2. **Leaked password protection** — necesită dashboard-ul Supabase Auth, fără acces prin SQL/MCP.
3. **Corectitudinea matematică a celor 585 pass** — am verificat că poarta nu minte pe eșantionul A3 (figuri); n-am re-rulat CAS-ul pe toate cele 660 de verificări de exerciții.
4. **Echivalența vizuală om-figură pe cele 13 relation** — poarta vizuală structurată trece 13/13, dar fără reproducere numerică singura validare a corectitudinii rămâne verdictul uman (3 au verdict, 10 nu).
5. **Query-ul inițial de cicluri** a căzut cu `No space left on device` (temp pe server la UNION ALL cu path-uri); re-scris cu închidere tranzitivă deduplicată → a rulat complet și a dat 0. Rezultatul final e verificat, metoda inițială nu.
