# ETAPA 84 — RAPORT FINAL (fix hartă: teme per clasă + gradient ordonat)

Două defecte DOVEDITE, reparate. R1-R4, eșecuri-întâi, commit per fază, gate build+test între faze.

## Cauza (FAZA A) — dovedită, nu presupusă
Harta se construia din `concept_family_membership` (7 domenii BAC, ~120 concepte,
concentrate pe clasa 12). Clasa 11 avea **1 singur** membru de familie → „1 temă",
deși în `concepts` sunt 234. Detalii + query + numărători: `FAZA-A-DIAGNOZA.md`.

## Fix (FAZA B) — sursa = `concepts`, grupată per clasă
- `build-map-layouts.ts` rescris: per-clasă, din TOATE conceptele clasei, grupate
  robust `module ?? subtopic ?? "Altele"` (grouping.ts, 5 teste). dagre BT precomputat.
- `layouts.ts`/`state.ts`: `GRADE_GROUPS`; fiecare grup = un „domain" cu o felie de clasă.
- **DOVADĂ NUMĂRATĂ (hartă == DB), per clasă:**

| clasă | înainte (hartă) | după (hartă) | DB | grupuri |
|---|---:|---:|---:|---:|
| 9 | 0 (absentă) | **135** | 135 | 99 |
| 10 | 7 | **211** | 211 | 58 |
| 11 | **1** | **234** | 234 | 67 |
| 12 | 112 | **242** | 242 | 73 |

(gate `etapa82-map-class`: hartă == DB pe fiecare clasă 9-12.)

## Sincronizare (FAZA C)
Titlul citea `studentGrade` (bug: „clasa 11" cu selectorul pe 12). Acum titlul, badge-ul
(`data-testid=map-badge`) și pastila activă citesc TOATE `selectedGrade` (clasa selectată).
Comuți clasa → titlu + badge + conținut se schimbă consecvent (screenshots harta-clasa-9..12).

## Gradient ordonat (FAZA D)
Butoanele de domeniu nu mai sunt curcubeu: `domainButton` (domain-style.ts, 6 teste) =
gama albastru-night, luminozitatea bg = progresul real la domeniu, tentă subtilă per grup
(hue 210-280) + text deschis. Plafon de luminozitate → AA. Gate `etapa84-domain-contrast`:
worst **5.78:1** (≥ AA), pe tot progresul × toată banda de tente. Nodurile-stele folosesc
deja gradientul mastery→albastru (ETAPA 83 C).

## Porți finale (FAZA E)
| poartă | rezultat |
|---|---|
| build | ✅ Compiled successfully |
| lint | ✅ 0 erori (19 warning-uri preexistente) |
| test (vitest) | ✅ **250** verzi (17 noi: grouping 5, domain-style 6, +6) |
| stress hartă (perf 72 SACRU) | ✅ heap 9.4 → 7.9 → 7.4 MB, zero crash/pageerror |
| contrast AA | ✅ paletă 37/37 + butoane domeniu 5.78:1 + etapa70 neregresat |
| qa-crawl | ✅ ZERO erori de consolă |
| acceptanțe 60-83 (eșantion) | ✅ 71-map (model nou), 72-stress, 74-qa-crawl, 82-map-class (hartă==DB), 83-formule |

## Screenshots (docs/design-review/etapa84/)
`harta-clasa-9/10/11/12.png` — fiecare cu TOATE temele clasei, butoane în gradient
albastru coerent, titlu + badge sincron cu clasa selectată.

## Pentru Maxim (onestitate)
113 concepte de clasa 11 (și 65 de clasa 10, 151 de clasa 12) au `module` NULL în DB →
sunt grupate pe `subtopic` (vizibile pe hartă, dar nu sub un „modul" oficial). Clasa 9 are
`module` 100% NULL → grupată integral pe subtopic. Atribuirea modulelor oficiale acestor
concepte e un pas de conținut (R5: nu inventăm module) — recomandat pentru o curățare ulterioară.
