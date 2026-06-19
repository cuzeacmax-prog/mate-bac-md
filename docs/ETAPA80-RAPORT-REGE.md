# ETAPA 80 — RAPORTUL-REGE

_Solvere geometrice extinse + harta topic→concept lărgită. Totul din tabele (zero invenție)._

## 0. Curățenie 79 (mis-legături rupte)
- 4 răspunsuri de integrală (§4 Probleme recapitulative) mis-legate pe Modulul V geometrie → **legături rupte** (#13,#14,#15,#16). Scan: **0** răspunsuri de calcul rămase pe geometrie. Exercițiile rămân fără răspuns oficial până la re-legare validă.
- Coadă body-uri /admin/continut confirmată funcțională (radical malformat, Modulul III #27) — `docs/design-review/etapa80/body-queue.png`.

## 1. Verificate CAS per familie — ÎNAINTE (79) → DUPĂ (80)

| Familie | Verificat înainte | Verificat după | Neconcordant | Nerezolvabil |
|---|---:|---:|---:|---:|
| con | 11 | 11 | 0 | 0 |
| tetraedru | 2 | 2 | 0 | 0 |
| paralelipiped | 0 | 5 | 0 | 0 |
| piramidă | 0 | 1 | 0 | 0 |
| prismă | 0 | 1 | 1 | 0 |
| trunchi | 0 | 0 | 0 | 0 |
| **TOTAL** | **13** | **20** | — | — |

Geometria verificată CAS: **13 → 20** exerciții (Modulele V-VI). Solvere noi: paralelipiped, piramidă regulată, prismă dreaptă, frustum — fiecare cu poartă anti-regres (pozitiv + negativ-control).

> Notă: verdictele NEREZOLVABIL-CAS sunt persistate cu metoda generică `cas_geometry` (fără sufix de formă), deci coloana lor pe familie e 0 aici; defalcarea reală a celor nerezolvabile e în secțiunea 3 (harta capabilităților).

## 2. LISTA NECONCORDANT (arbitraj Maxim — el decide cine are dreptate)

- **[Modulul V #3]** id=`1cab8386-9813-417d-b977-736bff49722d`
  - enunț: Laturile bazei unei prisme triunghiulare drepte au lungimile de $10\,cm$, $17\,cm$ și $21\,cm$, iar înălțimea prismei are $18\,cm$. Să se afle aria secțiunii duse prin muchia laterală și înălțimea mai
  - **CAS:** 144.0000
  - **ipoteză:** ETAPA 80 arbitraj: secțiunea prin muchia laterală + înălțimea mică a bazei = dreptunghi (înălțimea mică 8 cm × înălțimea prismei 18 cm) = 144 cm². Oficial: 14 cm². Ipoteză: typo în culegere (14 → 144) sau mis-extracție. Decizia umană: Maxim.

## 3. Capabilități rămase (NEREZOLVABIL-CAS → ETAPA 81)

- **5×** piramidă cu bază neregulată / față perpendiculară (neacoperit)
- **4×** tabel multi-parametru (solver de tabel)
- **3×** prismă cu bază neacoperită (paralelogram/condiție specială)
- **3×** paralelipiped: combinație parametri/cerere neacoperită
- **1×** raport între două corpuri
- **1×** con: cantitate cerută nerecunoscută

## 4. Diagnostic v2 — ÎNAINTE (79) → DUPĂ (80)

- **Itemi v2 oficiali:** 40 → **148** (țintă ≥150 — atinsă practic).
- **Topice acoperite:** 5 → 5; **generați dezactivați:** 72; **topice pe plasă:** 17.
- Acoperire v2 per topic: integrale:87, geometrie_3d:23, arii_volume:22, primitive:15, probabilitati:1
- Topice pe PLASĂ (fără conținut oficial eligibil — onest): algebra_ecuatii, siruri, trigonometrie_baza, siruri_avansate, numere_complexe, combinatorica, functii, ecuatii_log_exp, algebra_inecuatii, logaritmi, derivate, exponentiale, limite, derivate_aplicatii, polinoame, inecuatii_log_exp, matrici_determinanti

## 5. Maparea nouă topic→concept (REVIZUIRE UMANĂ — Maxim)
- +18 slug-uri pe potrivire de domeniu clară (anti-fabricație), pe 3 topice existente:
  - `integrale` += proprietăți / metoda substituției / integrarea prin părți (def.) / teorema de medie;
  - `primitive` += integrarea prin părți (nedef.) / schimbarea de variabilă;
  - `geometrie_3d` += piramidă, prismă, paralelipiped(-dreptunghic)+volum, con+arie+volum, trunchi de con+volum.
- Poartă `verify:topic-map`: 68/68 slug-uri există în `concepts`. Cele 17 topice fără conținut oficial eligibil rămân pe plasă.
- C4: cele 126 exerciții deblocate AVEAU deja link-urile exercițiu-concept; gâtul era strict harta → 0 re-linkări noi necesare.

---
_Generat: 2026-06-19T09:18:14.796Z · 154 teste vitest verzi (12 noi anti-regres) + build de producție OK._