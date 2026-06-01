# Audit complet — sistemul de figuri (ETAPA 23)

> Document READ-ONLY, citit din codul real la commit `7c19b14` (ETAPA 22). Nu s-a modificat cod.
> Scop: descriere TOTALĂ a modului în care se construiesc figurile, ca să știm exact pe ce construim.

## 0. Hartă de fișiere

| Fișier | Rol |
|---|---|
| `src/lib/figures/spec.ts` | Contractul de date (`FigureSpec2D`) + solverul pur (constrângeri → coordonate) + încadrarea canonică |
| `src/components/figures/FigureRenderer.tsx` | Componentă client React; traduce specul în primitive native JSXGraph (SVG) |
| `src/app/admin/figuri/page.tsx` | Pagina de probă (gard admin moștenit din `admin/layout.tsx`) |

Dependență: **`jsxgraph` v1.12.2**, licență `(MIT OR LGPL-3.0-or-later)` — OK comercial. Renderer `svg`. Import dinamic client-side (în `useEffect`), niciodată la SSR.

---

## 1. `FigureSpec2D` — tipul integral (semnături TypeScript exacte)

### Structura rădăcină
```ts
interface FigureSpec2D {
  points: FigurePoint[];
  elements: FigureElement[];
  boundingBox?: [number, number, number, number];      // [xmin, ymax, xmax, ymin] (convenția JSXGraph)
  framing?: { baseEdge?: [string, string]; anchor?: "bottom-left" };
}

interface FigurePoint { id: string; x: number; y: number; label?: string }

type Tri = [string, string, string];                    // 3 id-uri de vârf
type LineRef = string | [string, string];               // id de element SAU pereche de puncte
interface SolvedPoint { x: number; y: number; label?: string }
```

### `FigureElement` — uniune discriminată pe `kind`, TOATE variantele

**Generatori de coordonate** (rezolvați în `solveBasePoints`, nu desenați direct):
```ts
{ kind: "triangleFromSides"; ids: Tri; sides: { AB: number; BC: number; CA: number }; labels?: Tri }
{ kind: "quadFromConstraints";
  ids: [string, string, string, string];
  angleAt: string; angle: number; sideRatio: [number, number];
  scaleBy: { diagonal: "AC" | "BD" | "AB" | "AD"; length: number } }
```

**Poligoane / cercuri de triunghi:**
```ts
{ kind: "polygon"; points: string[]; label?: string; shade?: boolean; color?: string; fillOpacity?: number }
{ kind: "circumcircle"; of: Tri; centerLabel?: string; color?: string }
{ kind: "incircle"; of: Tri; centerLabel?: string; color?: string }
```

**Puncte remarcabile / intersecție** (DOUĂ variante cu `kind:"point"`):
```ts
{ kind: "point"; from: "incenter" | "circumcenter" | "centroid" | "orthocenter";
  of?: Tri; label?: string; color?: string; id?: string }
{ kind: "point"; from: "intersection"; of: [LineRef, LineRef];
  index?: number; label?: string; color?: string; id?: string }
```

**Drepte remarcabile în triunghi** (`from` = vârful):
```ts
{ kind: "median";       of: Tri; from: string; label?: string; color?: string; id?: string }
{ kind: "bisector";     of: Tri; from: string; label?: string; color?: string; id?: string }
{ kind: "altitude";     of: Tri; from: string; label?: string; color?: string; markRightAngle?: boolean; id?: string }
{ kind: "perpBisector"; of: Tri; from: string; label?: string; color?: string; id?: string }
```

**Unghi / cerc generic / tangente:**
```ts
{ kind: "angle"; at: string; from: [string, string]; label?: string; color?: string }
{ kind: "circle"; id?: string; center: string; through?: string; radius?: number; centerLabel?: string; color?: string }
{ kind: "tangentLines"; from: string; to: string; markPoints?: boolean; pointLabels?: [string, string]; color?: string }
```

**Relații / segmente / paralele:**
```ts
{ kind: "midpoint"; of: [string, string]; label?: string; color?: string; id?: string }
{ kind: "perpendicular"; through: string; toSegment: [string, string]; label?: string; color?: string; id?: string }
{ kind: "parallel";      through: string; toSegment: [string, string]; label?: string; color?: string; id?: string }
{ kind: "parallelAtDistance"; id?: string; parallelTo: [string, string]; offsetFrom: string; distance: number; color?: string; visible?: boolean }
{ kind: "segment"; between: [string, string]; label?: string; color?: string; id?: string; showLength?: boolean }
```

**Semne convenționale:**
```ts
{ kind: "equalMark";    on: [string, string]; count?: number; color?: string }   // liniuțe de egalitate
{ kind: "parallelMark"; on: [string, string]; count?: number; color?: string }   // chevron de paralelism
```

**Total: 23 variante de `kind`** (din care 2 sunt generatori, 2 sunt sub-variante `point`).

### Funcții pure exportate din `spec.ts`
- `solveBasePoints(spec): Record<id, SolvedPoint>` — coordonatele de bază. Explicite din `spec.points`; SSS din `triangleFromSides` (legea cosinusului, A la origine, B pe Ox, C calculat); paralelogram din `quadFromConstraints`. **Aruncă** la inegalitatea triunghiului sau triunghi degenerat.
- `frameSolved(solved, framing?): Record<id, SolvedPoint>` — încadrarea canonică (vezi §2D).
- `autoBoundingBox(spec): [..]` — cadru auto din punctele rezolvate (folosit doar pe ramura `geogebra`).

---

## 2. `FigureRenderer.tsx` — construcția board-ului

### A. Fluxul de randare (`useEffect`, client-only)
1. `import("jsxgraph")` dinamic.
2. `base = solveBasePoints(spec)`.
3. `solved = style === "bac" ? frameSolved(base, spec.framing) : base`.
4. `box = style === "bac" ? boxOf(...) : autoBoundingBox(spec)`.
5. `JXG.JSXGraph.initBoard(div, { boundingbox, keepaspectratio:true, axis:false, grid:false, showCopyright:false, showNavigation:false, renderer:"svg", pan:{enabled:false}, zoom:{enabled:false} })`.
6. `buildFromSpec(JXG, board, spec, solved, theme)` → `board.update()`.
7. Capturează `div.querySelector("svg").outerHTML` în state pentru export.
8. Cleanup: `JXG.JSXGraph.freeBoard(board)`.

### B. Intrarea punctelor: explicit vs prin constrângeri
- **Explicit**: `spec.points[]` → `solveBasePoints` le copiază 1:1.
- **Prin constrângeri** (ETAPA 21), rezolvate ÎNAINTE de randare în `solveBasePoints`:
  - `triangleFromSides` → SSS: `x_C=(AB²+CA²−BC²)/(2·AB)`, `y_C=√(CA²−x²)`; A=(0,0), B=(AB,0).
  - `quadFromConstraints` → A=(0,0), B=(sideRatio[0],0), D la unghi, C=B+D, apoi scalare ca diagonala aleasă să aibă lungimea cerută.
- **Puncte derivate la randare** (NU sunt „de bază”, calculate de JSXGraph, expuse prin `id`/`label` în harta `pts`):
  - `point.from:"intersection"` → `intersection` nativ pe două `LineRef` (id de element din harta `els` SAU dreaptă prin 2 puncte). `index` alege ramura (cerc).
  - `parallelAtDistance` → punct offset prin **coordonate-funcție** (normală × distanță, semn spre `offsetFrom`) + `parallel` nativ; expus în `els`.

### C. Maparea relație → primitivă NATIVĂ JSXGraph

| `kind` | Primitivă(e) JSXGraph | Note |
|---|---|---|
| `triangleFromSides`, `quadFromConstraints` | — (no-op la desen) | doar coordonate |
| `polygon` | `polygon` | `borders`, `fillOpacity` (0 în bac), `vertices.visible:false` |
| `circumcircle` | `circumcircle` | centru etichetat „O” |
| `incircle` | `incircle` | centru etichetat „I”; tangența calculată de motor |
| `point` incenter/circumcenter | `incenter` / `circumcenter` | native |
| `point` centroid | `point` cu coordonate-funcție `(ΣX/3, ΣY/3)` | nu există element nativ |
| `point` orthocenter | `perpendicular`×2 + `intersection` | înălțimi din 2 vârfuri |
| `point` intersection | `intersection` (+ `line` ad-hoc dacă `LineRef` e pereche) | |
| `median` | `midpoint` + `segment` | segment vârf→mijloc |
| `bisector` | `bisector` (ascuns) + `intersection` cu latura opusă + `segment` | ceviană până la latură; dreapta `bisector` stocată în `els` |
| `altitude` | `perpendicularpoint` + `segment` (+ `angle type:"square"` dacă `markRightAngle`) | |
| `perpBisector` | `midpoint` + `perpendicular` (dreaptă infinită) | mediatoarea laturii opuse |
| `angle` | `angle` (`type:"sector"`) | etichetă opțională |
| `circle` | `circle` (`[center, through]` sau `[center, radius]`) | stocat în `els` prin `id` |
| `tangentLines` | `polarline` + `intersection`×2 + `line`×2 | T₁/T₂ marcate; cerc referit din `els` |
| `midpoint` | `midpoint` | expus în `pts` prin `id` |
| `perpendicular` | `line` (ascuns) + `perpendicular` | prin punct, la segment |
| `parallel` | `line` (ascuns) + `parallel` | |
| `parallelAtDistance` | `point`(funcție) + `line` + `parallel` | dash; stocat în `els` |
| `segment` | `segment` | `showLength` → nume = lungime calculată live |
| `equalMark` | `segment`×count (puncte-funcție) | liniuțe perpendiculare la mijloc, mărime 0.05·L |
| `parallelMark` | `segment`×2×count (puncte-funcție) | chevron `>` la mijloc, mărime 0.045·L |

Toate elementele cu `id` (segmente, cercuri, drepte, ceviene) se stochează în harta `els` pentru a fi referite în `intersection`.

### D. Încadrarea canonică (`frameSolved`) — DOAR pe ramura `bac`
Similaritate aplicată DUPĂ rezolvare (geometrie EXACTĂ — unghiuri, rapoarte, lungimi păstrate):
1. `A` = `framing.baseEdge[0]` sau punctul `"A"` sau primul id.
2. `B` = `framing.baseEdge[1]` sau **vârful cel mai depărtat de A** (latura cea mai lungă din A).
3. Rotație cu `−atan2(B−A)` în jurul lui A → A la origine, AB pe Ox.
4. Dacă media `y` < 0 → reflexie verticală (`y → −y`) ca figura să fie deasupra bazei.
> Scalarea/translația finală o face board-ul JSXGraph (`boundingbox` + `keepaspectratio`).

### E. Teme de prezentare (nu ating geometria)
```ts
geogebra: { ink:"#0f172a", lw:2,   fill:0.04, ptSize:2,   colors:true,  serif:false, angleFill:0.22, bac:false }
bac:      { ink:"#1a1a1a", lw:1.3, fill:0,    ptSize:1.4, colors:false, serif:true,  angleFill:0,    bac:true }
```
- `colors:false` (bac) → `col()` ignoră `e.color`, totul devine negru (#1a1a1a).
- `bac`: ZERO umbriri (`fillOpacity:0`, chiar și `shade:true`); etichete vârfuri serif italic 16px cu `autoPosition:true` (le împinge în afara liniilor); arce de unghi goale; unghi drept = pătrățel negru; puncte mici negre; fundal transparent; container **aspect peisaj** (`h = size·0.74`).
- `geogebra`: păstrează culorile per element, fill ușor, etichete sans-serif cu offset fix.
- `style` prop implicit = **"bac"**.

### F. Export SVG
`downloadSvg()` serializează `svg.outerHTML` într-un Blob `image/svg+xml` și declanșează descărcare `figura.svg`. Buton „↓ Export SVG” sub fiecare figură.

---

## 3. `/admin/figuri` — figuri-probă existente acum

Pagina afișează **2 rânduri de comparație**, fiecare cu aceeași spec randată în `geogebra` (vechi) ALĂTURI de `bac` (nou) + JSON-ul specului:

1. **`FIG_TRAPEZ`** — `points:[]`; `triangleFromSides (26,26,20)` + `polygon ABC` + `parallelAtDistance` (MN∥AC, dist 18, vizibil:false) + 2× `point intersection` (M, N) + `polygon AMNC` (shade) + 3× `segment` etichetat (26/26/20) + 2× `equalMark` (AB, BC) + 2× `parallelMark` (AC, MN).
2. **`FIG_PARA`** — `points:[]`, `framing.baseEdge:[A,B]`; `quadFromConstraints (∠A=60°, AB:AD=1:2, BD=3)` + `polygon ABCD` + `segment BD` + `bisector` din A (`id:bisA`) + `point intersection` (K = bisA ∩ BD) + `angle` la A (60°).

> Notă: figurile-probă din ETAPA 20 (4 puncte remarcabile + cercuri; 2 tangente; înălțime cu unghi drept) au fost ÎNLOCUITE în pagină de cele 2 comparații. Vocabularul rămâne în renderer; doar pagina nu le mai afișează.

---

## 4. Inventar TRIUNGHI — prezent vs lipsă

### PREZENT (suportat prin `kind`)
- ✅ Mediană (`median`) — segment vârf→mijloc.
- ✅ Bisectoare interioară (`bisector`) — ceviană până la latura opusă.
- ✅ Înălțime (`altitude`) — segment vârf→picior, opțional unghi drept.
- ✅ Mediatoare (`perpBisector`) — dreaptă infinită pe mijlocul laturii.
- ✅ Incentru (`point from:"incenter"`), Circumcentru (`circumcenter`), Centroid (`centroid`), Ortocentru (`orthocenter`).
- ✅ Cerc înscris (`incircle`) și circumscris (`circumcircle`) cu centre etichetate.
- ✅ Unghi cu arc + etichetă (`angle`); unghi drept ca pătrățel (prin `altitude.markRightAngle`).
- ✅ Etichete vârfuri (serif italic în bac, `autoPosition`), etichete de lungime pe segment (`label` / `showLength`).
- ✅ Semne de egalitate (`equalMark`) și de paralelism (`parallelMark`).
- ✅ Intrare prin laturi (SSS, `triangleFromSides`).

### LIPSĂ (neimplementat)
- ❌ **Ceviană generică ca segment etichetat** (vârf → punct dat pe latura opusă, cu raport/lungime).
- ❌ **Bisectoare EXTERIOARĂ** a unui unghi.
- ❌ **Dreapta lui Euler** (O–G–H) ca obiect explicit (deși cele 3 puncte există → s-ar putea construi).
- ❌ **Cercul celor 9 puncte** (Euler) + centrul său (mijlocul OH).
- ❌ **Punctele de tangență ale cercului înscris** cu laturile (marcate).
- ❌ **Excercuri / excentre** (cercuri exînscrise).
- ❌ **Mediană/înălțime/bisectoare prelungite** sau prelungiri de laturi.
- ❌ **Etichetă de UNGHI ca valoare măsurată** automat (acum `angle.label` e text liber, nu măsura).
- ❌ **Simediană, dreapta antiparalelă, punct Gergonne/Nagel, cerc tangent etc.** (geometrie avansată).
- ❌ **Cotare/segmente cu săgeți de dimensiune** (dimension lines) stil tehnic.
- ❌ **Hașură de regiune** în stil BAC (acum bac e fără fill din principiu).

---

## 5. Stare 3D

### Sistemul de FIGURI (JSXGraph 2D): **ZERO 3D.**
`FigureSpec2D`, `FigureRenderer` și `/admin/figuri` sunt strict 2D. Nicio primitivă 3D, nicio proiecție în sistemul de figuri.

### Există însă o infrastructură 3D SEPARATĂ (preexistentă, neintegrată cu figurile)
- `src/lib/spatial/` — generează **proiecție cabinet** `(x,y,z) → (x + 0.45z·cos30°, y + 0.45z·sin30°)`:
  - `projections3D.ts` (`generateProjection3D`) — paralelipiped + proiecție punct pe plan.
  - `dihedralAngle.ts` (`generateDihedralAngle`) — unghi diedru (2 semiplane, muchie comună).
  - `threePerp.ts` (`generateThreePerp`) — teorema celor 3 perpendiculare.
  - Endpoint `POST /api/admin/generate-spatial` (`type: 'projection' | 'dihedral' | 'three_perp'`).
- `src/components/chat/ThreeRenderer.tsx` + `ThreeScene.tsx` — **three.js** (`three@^0.184`, `@react-three/fiber@^9`, `@react-three/drei@^10`), 3D interactiv în chat, cu `CabinetSVG.tsx` ca fallback.

→ Acest 3D NU folosește `FigureSpec2D`, e un subsistem paralel (chat/spatial), pe alt model de date și alt motor de randare.

### Ce ar oferi JSXGraph pentru 3D (dacă vrem să unificăm pe el)
JSXGraph 1.12.2 **are 3D nativ** în `node_modules/jsxgraph/src/3d/`: `view3d`, `point3d`, `line3d` (linspace), `plane3d`, `polygon3d`, `polyhedron3d`, `box3d`, `sphere3d`, `circle3d`, `curve3d`, `surface3d`, `face3d`, `text3d`, `ticks3d`. Deci s-ar putea extinde `FigureSpec2D` → `FigureSpec3D` pe `view3d` (proiecție + rotație), păstrând principiul „corect prin construcție”. Alternativă: three.js (deja în proiect, mai greu, mai puțin „matematic”).

---

## 6. Limitări cunoscute, versiuni, discrepanțe cod ↔ commit-uri

### Versiuni
- `jsxgraph` **1.12.2** (MIT/LGPL). `three` **^0.184.0** (subsistem 3D separat).

### Limitări / capcane în implementarea curentă
1. **`quadFromConstraints.angleAt` e IGNORAT de solver** — unghiul se construiește mereu la `ids[0]` (A). Câmpul există în tip dar nu schimbă comportamentul. (În probă `angleAt:"A"` coincide, deci nu se vede.)
2. **Fără validare de spec înainte de randare** — un `id` referit dar inexistent → `pts[id] === undefined` → eroare JSXGraph la runtime (prinsă în `try/catch`, afișată ca „Eroare la randarea figurii”). Nu există verificare de referințe/închidere de poligon.
3. **`point.from:"intersection"` fără `id`** se înregistrează sub `label`; două puncte cu același `label` s-ar suprascrie în `pts`.
4. **Semnele (`equalMark`/`parallelMark`)** au mărime relativă la lungimea laturii (0.05·L / 0.045·L) → pe laturi de lungimi diferite, semnele au mărimi diferite. În tema `bac` ignoră `color` (totul negru).
5. **`perpBisector` și `parallel`/`perpendicular`** produc drepte INFINITE (nu segmente) — pot ieși din cadru.
6. **Două formule de cadru**: `geogebra` → `autoBoundingBox` (pad `0.9·half + max(2,0.5·half)`); `bac` → `boxOf` (pad `0.5·half + max(2,0.35·half)`). Încadrări ușor diferite între teme.
7. **`firstTriangle()`** (fallback pentru puncte remarcabile fără `of`) folosește primul `polygon` sau primele 3 chei din `solved` — fragil dacă figura n-are triunghi clar.
8. **`useEffect` depinde de `[spec, style, th]`** prin identitate de obiect — refolosește OK fiindcă specurile din pagină sunt `const` la nivel de modul; un spec construit inline la fiecare render ar re-crea board-ul de fiecare dată.
9. **Marcatorul de unghi drept** apare DOAR pe traseul `altitude.markRightAngle`; nu există un `kind` separat de „unghi drept” reutilizabil.
10. **Randare strict client-side** (JSXGraph cere DOM); la SSR pagina trimite doar containerul gol. Nicio imagine pre-randată pe server.

### Discrepanțe cod ↔ ce pretindeau commit-urile
- **ETAPA 20** („vocabular figuri 2D extins”): vocabularul (4 puncte remarcabile, tangente, înălțime+unghi drept) ESTE în renderer, dar figurile-probă corespunzătoare din pagină au fost ÎNLOCUITE la ETAPA 22 cu cele 2 comparații. Deci pagina nu mai arată tot ce promitea commit-ul ETAPA 20 — codul de randare însă le suportă.
- **ETAPA 21/22**: commit-urile NU conțin cuvântul „figur” în mesaj (`strat de intrare prin constrangeri`, `tema vizuala BAC`), deci un `git log --grep=figur` le ratează. Conținutul lor e însă exact figuri.
- Restul afirmațiilor din commit-uri (SSS, paralelogram, intersecții, tangente prin polară, temă BAC, încadrare canonică) corespund codului real verificat mai sus.

### Concluzie
Sistemul de figuri 2D e **solid și compozabil**: 23 de relații, intrare prin constrângeri rezolvate determinist, prezentare comutabilă (BAC/GeoGebra), export SVG. Lipsesc construcții de triunghi avansate (Euler, 9 puncte, excentre, ceviană generică etichetată) și ORICE 3D în acest sistem (3D-ul existent e un subsistem three.js separat, neintegrat). JSXGraph oferă deja 3D nativ ca posibilă cale de unificare.
