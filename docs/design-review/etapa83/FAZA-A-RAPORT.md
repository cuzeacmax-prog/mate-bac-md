# ETAPA 83 FAZA A — Raport mapare concept → clasă (din manuale)

> R5 respectat: maparea e EXTRASĂ din cuprinsul manualelor oficiale (Prut), nu ghicită.
> Onestitate > completitudine. Maxim e arbitrul — nimic nu se scrie automat.

## Surse (A1)
- Cuprins extras VERBATIM din `docs/manuale-source/clasa-09..12.pdf` →
  `docs/manuale-source/curriculum-cuprins.json` (4 clase, 38 module, 151 teme de conținut).
- Lizibil: `docs/CURRICULUM-EXTRAS.md` (modul + temă + pagină per clasă).
- Diacriticele au fost reconstruite unde fontul PDF le-a stricat (notat per clasă în extragere).

## Matcher (A2) — onest, determinist
`src/lib/curriculum/match.ts` (+ 9 teste `tests/curriculum/match.test.ts`):
- potrivire la nivel de **entry** (un titlu de temă/modul), cu stemming ușor RO;
- **FERM** doar dacă: acoperire ≥75% din tokenii conceptului + ≥1 token **distinctiv**
  (nu doar cuvinte generice ca „funcție/grafic/real") + potrivire **unică pe o singură clasă**;
- altfel **NESIGUR** (apare în ≥2 clase, acoperire slabă, doar în recapitulare, sau fără potrivire);
- modulele de **recapitulare** (ex. clasa 12 „Recapitulare finală") sunt excluse ca „clasă de origine".
- Lecție de onestitate: prima variantă (token-overlap pe clasă) producea 118 ferme cu false
  pozitive pe un singur cuvânt comun → înăsprită la entry-level + token distinctiv.

## Rezultat (A4) — 822 concepte (clasele 9-12)
| | n |
|---|---:|
| FERME | 146 |
| — din care **schimbări de clasă** | 49 |
| — confirmări (propus = actual) | 97 |
| NESIGURE (pentru Maxim) | 676 |
| Fără clasă inițială | 0 |

Distribuție grade_level **înainte**: `9:135 · 10:211 · 11:234 · 12:242`
Distribuție **dacă se aplică doar fermele**: `9:140 · 10:212 · 11:253 · 12:217`

Exemple de schimbări ferme corecte (verificate): `g12-diferentiala-unei-functii 12→11`
(clasa 11 §5), `g12-interpretarea-geometrica-a-derivatei 12→11` (clasa 11 §2),
`g11-functie-radical 11→10` (clasa 10 §3). Unele rămân de arbitrat (ex. arii: 10↔9 —
apar explicit în clasa 9, recapitulate în clasa 10).

## Coada de revizuire (A3) — `/admin/curriculum`
- Tabel: concept × clasa_actuală × clasa_propusă × **sursă (manual + pagină)** × [ferm/nesigur],
  cu **Acceptă / Corectează (dropdown 9-12) / Lasă** + **Confirmă toate fermele**.
- `curriculum_proposals` (migrație `20260623000002`, RLS intern-admin, 822 rânduri populate).
- API `/api/admin/curriculum` (doar admin): `grade_level` se scrie **numai** la acțiunea
  ownerului; **niciodată** automat, **niciodată** pe „nesigur" fără clasă aleasă.
- POARTĂ A (acceptanță `etapa83-curriculum-acceptance`): coadă populată + calea de aplicare
  grade_level → hartă dovedită end-to-end pe un concept, apoi **revenită** (net zero;
  curriculumul lui Maxim rămâne neatins până decide el).

## Pentru Maxim
1. Deschide `/admin/curriculum` → tab „Schimbări ferme (49)": acceptă/corectează/lasă fiecare,
   sau „Confirmă toate fermele".
2. Tab „Nesigure (676)": cazurile pe care matcher-ul NU le-a putut plasa clar — decizia ta.
3. După ce confirmi schimbări, regenerează layout-urile hărții
   (`npm run … build-map-layouts`) ca harta clasei să le reflecte.
