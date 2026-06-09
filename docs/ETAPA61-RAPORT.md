# ETAPA 61 — RE-LINKARE CURATĂ exercițiu↔concept (2026-06-09)

## EȘECURILE ȘI GOLURILE ÎNTÂI

### 1. Orfani: 281/1268 exerciții (22,2%) — marcați onest, nu linkați forțat
Per modul (query LEFT JOIN anti-link):
| Modul | Orfani / Total | Cauza dominantă |
|---|---|---|
| I | 22 / 116 | sub prag |
| II | 83 / 285 | sub prag (multe integrale „seci" fără text care să tragă similaritatea) |
| III | 34 / 144 | sub prag + enunțuri-titlu („Calculați:") |
| IV | 40 / 168 | sub prag + „NICIUN candidat în familie" (probleme narative) |
| V | 6 / 228 | sub prag |
| VI | 1 / 162 | sub prag |
| VII | **71 / 71 — ORFAN DELIBERAT** | vezi §2 |
| VIII | 24 / 94 | familie mică (3 concepte de polinom în graf) |

10 exemple cu cauza exactă (query în istoric): `∫ sin∛x/∛x² dx` (I, max in-familie 0.496), `Cubul ABCD…` (V, 0.478), `Într-un coș sunt 28 de mere…` (IV, NICIUN candidat), `Calculați:` (III, 0.461 — enunț-titlu, defect de extracție), `∫ 1/cos⁴x dx` (II, 0.497), etc.

### 2. Modulul VII exclus DELIBERAT de la linkare (decizie luată pe dovadă, în timpul etapei)
Prima versiune dădea modulului VII (teste recapitulative MIXTE) familia-uniune + algebră liceală. Testul canonic a arătat imediat: integrale din testele VII se linkau la `g10-modulul-numarului-real` cu sim 0.59–0.66 — la un modul mixt poarta de curriculum e VIDĂ și similaritatea singură nu duce greutatea. Per principiul etapei (mai bine lipsește onest), VII = listă goală în hartă, linkuri+membership șterse. Impact produs: ZERO (VII nu are exerciții verificate). Relinkarea VII cere clasificare per-exercițiu — etapă viitoare.

### 3. 110 concepte au PIERDUT toate exercițiile verificate (frontiera sărăcită onest)
Înainte: 127 concepte aveau ≥1 „exercițiu verificat" prin linkuri. După: **17** — TOATE din familia integralelor (singura cu verificare CAS: Module I–II): `g12-proprietatile-integralei-definite` (186), `g12-metoda-substitutiei…` (117), `…prin-parti…` (73), … `g12-functie-integrabila-in-sens-riemann` (1). Cele 110 pierzătoare erau beneficiari de zgomot (ex.: `g10-modulul-numarului-real` „avea" 113). Consecință vizibilă în acceptare: frontiera elevului de test nu mai are concepte cu exerciții verificate în top-5 — integralele sunt blocate corect de prerechizite sub prag. Stare onestă: **gol de conținut** (verificare doar pe 2/8 module), nu zgomot.

### 4. Limite recunoscute ale metodei
- Scorurile vin din linkurile legacy (top-9/exercițiu) — un concept corect care nu era în top-9 inițial nu poate fi recuperat fără recalcul de embeddings pe exerciții (nepersistate). Marcat ca limitare.
- Pragul 0.50 NU e o „vale naturală" — distribuția e netedă (recunoscut explicit); e tăietura decilei slabe (p10 in-family=0.476), poarta primară fiind curriculum-ul.
- Legacy conținea 2452 perechi duplicate (metode multiple) — dedup cu max(similarity); prima rulare a migrației a picat exact pe asta (rollback curat, refăcută).
- Bug găsit pe drum: PostgREST taie la 1000 rânduri — prima construcție de membership a folosit 1000/3229 muchii; reparat cu paginare + gardă (`edges<3000 → exit 1`).

## Distribuția linkuri/exercițiu: ÎNAINTE vs DUPĂ
| | Înainte (legacy) | După |
|---|---|---|
| Linkuri totale | 11 199 | **2 300** |
| Median / max per exercițiu | 9 / 9 | **3 / 3** |
| Exerciții cu ≥1 link | 1 268 | 1 041 − 54(VII) = **987** |
| Orfani | 0 (fals: totul linkat) | **281, marcați** |
| Constrângere de domeniu | niciuna | familie de modul, persistată |
| Proveniență | nu | similarity, rank, module_ok, created_by='etapa61' |

## Per pas

**PAS 1** (`276d7e7`): `module-concept-map.ts` — 8 module → rădăcini explicite (conținut citit din `exercise_raw.section`, nu presupus); poarta `verify:module-map` (30/30 rădăcini după excluderea VII, 8/8 module); `concept_family_membership` construit din muchii (BFS, 3229 muchii paginat) și persistat: I=25, II=13, III=15, IV=33, V=21, VI=29, VIII=3 concepte. Familia VIII e săracă (3) — graful are puține concepte de polinoame.

**PAS 2** (`c6dad3e`): distribuția similarităților raportată (in-family: p10 0.476/median 0.627/p90 0.725; out-family: median 0.610 — suprapunere puternică = dovada că similaritatea singură nu separă domeniile); prag 0.50 justificat pe decila slabă + tabel de acoperire (0.50→227 orfani; 0.55→436; 0.60→598; 0.65→791); legacy arhivat INTACT ca `exercise_concept_link_legacy`; tabel nou cu proveniență + RLS + grants; VII șters pe dovadă.

**PAS 3**: produsul citește linkurile live — `frontier_concepts` e funcție SQL STABLE peste tabele, `anchor.ts` interoghează direct; zero view-uri materializate/cache-uri. Testul de frontieră cu assert re-rulat pe linkurile noi: **exit 0** (X în frontieră, Y blocat, Z exclus, invariante pe 132 rânduri).

**PAS 4 — testul canonic**:
- `g10-modulul-numarului-real`: 167 linkuri / „113 verificate" (module I–IV+VII!) → **0 linkuri / 0 verificate**. Zero integrale. ✓
- Eșantion 10 concepte diverse cu top-3 + snippet (în istoric, repetabil): con→probleme de con (0.73–0.76), piramidă→piramide (0.75–0.78), binom→dezvoltări (0.70–0.73), polinom→polinoame (0.65–0.66), combinări→submulțimi (0.65–0.67), primitivă→primitive (0.66–0.68), volum rotație→corp de rotație (0.71–0.75), sferă→sfere (0.65–0.66), integrală definită→integrale (0.63–0.65). `g12-probabilitatea-clasica` = 0 linkuri (familia IV are candidați narativi sub prag) — gol onest, listat.

## Acceptarea ETAPA 60 re-rulată pe linkurile noi
User de audit `etapa60-acceptance@test.local` (mastery resetat, repetabil): aceleași 14 rânduri mastery; frontiera nouă = concepte g10 de fundament cu 0 exerciții verificate (corect: singura familie verificată — integralele — e blocată de prerechizite cu mastery 0.51<0.6). Zgomotul a dispărut din top; rămâne golul de conținut (§3).

## Verificare finală
- `npm run build` → exit 0 · `eslint --quiet` → exit 0 · `vitest` 21/21
- Porți: `verify:module-map` ✓ (30 rădăcini, 8 module) · `verify:topic-map` ✓ (52/52, 22/22)
- `frontier-test` ✓ · `etapa60-acceptance` ✓ (pe linkuri noi)
