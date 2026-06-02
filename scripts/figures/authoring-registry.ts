/**
 * ETAPA 46 — EXTRACȚIA pe care o furnizează Claude Code (abonament, NU API în app) pentru coada de autorat.
 * Mapează condiția (text liber din web) la intrarea de pipeline (relații + numere, ZERO coordonate).
 * Necunoscut → null (cazul rămâne marcat „extracție necesară"); adaug aici clasa nouă când o întâlnesc.
 *
 * Notă: enunțurile reale folosesc LITERE MATEMATICE italice (𝐴𝐵𝐶…) — le normalizez la ASCII întâi.
 */
import type { PipelineInput, DesiredDescriptor } from "../../src/lib/figures/authoring";
import { axialSection, dihedralSection } from "../../src/lib/figures/axial";
import { pyramidTrapezoidScene, circleSecantAngle } from "../../src/lib/figures/relations";
import type { Scene3D } from "../../src/lib/figures/spec3d";
import type { FigureSpec2D } from "../../src/lib/figures/spec";
import type { GeoProblem } from "../../src/lib/figures/cas";

type Resolved = { input: PipelineInput; desired?: DesiredDescriptor };
const NUM = "(\\d+(?:[.,]\\d+)?)";
const f = (s: string): number => parseFloat(s.replace(",", "."));

/** Litere matematice italice (𝐴–𝑍, 𝑎–𝑧) → ASCII, ca regex-urile pe „AB=…" să funcționeze. */
function normalizeMath(s: string): string {
  return Array.from(s).map((ch) => {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x1d434 && cp <= 0x1d44d) return String.fromCharCode(65 + (cp - 0x1d434)); // A–Z italic
    if (cp >= 0x1d44e && cp <= 0x1d467) return String.fromCharCode(97 + (cp - 0x1d44e)); // a–z italic
    return ch;
  }).join("");
}

/** Număr dintr-un fragment, acceptând a√b, a\sqrt{b}, √b, sau simplu a (LaTeX tolerat). */
function numTok(chunk: string): number | null {
  let m = chunk.match(/(\d+(?:[.,]\d+)?)\s*(?:\\?sqrt\s*\{?|√)\s*(\d+)/);
  if (m) return f(m[1]) * Math.sqrt(parseInt(m[2], 10));
  m = chunk.match(/(?:\\?sqrt\s*\{?|√)\s*(\d+)/);
  if (m) return Math.sqrt(parseInt(m[1], 10));
  m = chunk.match(/(\d+(?:[.,]\d+)?)/);
  return m ? f(m[1]) : null;
}
/** Prima valoare numerică (cu √) după un cuvânt-cheie. */
function near(c: string, kw: RegExp, span = 28): number | null {
  const m = c.match(kw); if (!m || m.index == null) return null;
  return numTok(c.slice(m.index + m[0].length, m.index + m[0].length + span));
}

/**
 * SOLID STANDARD (motor ETAPA 47): detectează TIPUL corpului din cuvinte-cheie + dimensiuni date (sau valori
 * de afișare dacă nu sunt parsabile direct) → pictogramă 3D. Acoperă marea masă a modulelor V/VI.
 */
function standardSolid(c: string): Resolved | null {
  const sides = c.includes("triunghiular") ? 3 : c.includes("hexagonal") ? 6 : c.includes("pentagonal") ? 5 : c.includes("patrulater") ? 4 : 4;
  const D = (apex = false): DesiredDescriptor => ({ dim: "3D", orientation: apex ? "apex-sus" : undefined, mustLabels: [], minPolylines: 6 });
  const baseEdge = near(c, /latura\s+baz[ei]/) ?? near(c, /muchia\s+baz[ei]/) ?? 4;
  const height = near(c, /[iî]n[aă]l[tț]ime[a]?/) ?? 6;

  if (c.includes("trunchi") && c.includes("piramid")) {
    const b1 = near(c, /baz[ei]l?or?[\s\S]{0,30}?(\d)/) ?? 10; // aprox; afișare
    return { input: { kind: "body3d", body: { kind: "frustum", baseSides: sides, baseEdge: Math.max(b1, 6), topEdge: Math.max(b1 / 2, 3), height } }, desired: D() };
  }
  if (c.includes("tetraedr")) return { input: { kind: "body3d", body: { kind: "tetrahedron", edge: near(c, /muchi[ae]/) ?? 5 } }, desired: D(true) };
  if (c.includes("paralelipiped") || c.includes("cuboid")) {
    return { input: { kind: "body3d", body: { kind: "box", length: near(c, /ad\s*=/) ?? 7, width: near(c, /ab\s*=/) ?? 4, height: near(c, /(?:aa.?1|[iî]n[aă]l[tț]ime)/) ?? 5 } }, desired: D() };
  }
  if (c.includes("cub")) { const e = near(c, /muchia/); const diag = near(c, /diagonal[aă]/); return { input: { kind: "body3d", body: { kind: "cube", edge: e ?? (diag ? diag / Math.sqrt(3) : 5) } }, desired: D() }; }
  if (c.includes("prism")) return { input: { kind: "body3d", body: { kind: "prism", baseSides: sides, baseEdge, height } }, desired: D() };
  if (c.includes("piramid")) return { input: { kind: "body3d", body: { kind: "regularPyramid", baseSides: sides, baseEdge, height } }, desired: D(true) };
  if (c.includes("cilindru")) return { input: { kind: "body3d", body: { kind: "cylinder", radius: near(c, /raz[aă]/) ?? 3, height } }, desired: D() };
  if (c.includes("sfer")) return { input: { kind: "body3d", body: { kind: "sphere", radius: near(c, /raz[aă]/) ?? 4 } }, desired: D() };
  if (/\bcon\b|conic/.test(c)) return { input: { kind: "body3d", body: { kind: "cone", radius: near(c, /raz[aă]/) ?? 3, height } }, desired: D(true) };
  return null;
}

export function resolveInput(condition: string): Resolved | null {
  const norm = normalizeMath(condition);
  const c = norm.toLowerCase();
  const num = (re: RegExp): number | null => { const m = c.match(re); return m ? f(m[1]) : null; };

  // ── con + plan paralel cu baza la o distanță de vârf → secțiune (distanță punct–plan = perpendiculara) ──
  if (c.includes("con") && c.includes("plan") && (c.includes("vârf") || c.includes("varf"))) {
    const H = num(new RegExp(`[iî]n[aă]l[tț]ime[\\s\\S]{0,40}?${NUM}`));
    const volCoef = num(new RegExp(`${NUM}\\s*(?:π|𝜋)`));
    const dist = num(new RegExp(`distan[tț]a[\\s\\S]{0,30}?${NUM}`));
    if (H && volCoef && dist) {
      const R = Math.sqrt((3 * volCoef) / H);
      return { input: { kind: "coneCut", cone: { radius: R, height: H }, by: { rel: "distanceApexToParallelPlane", value: dist } }, desired: { dim: "3D", orientation: "apex-sus", mustLabels: ["V", "O", String(dist)], minPolylines: 6 } };
    }
  }

  // ── piramidă cu apotema bazei + unghi diedru la bază → secțiune triunghi dreptunghic VOM ──
  if (c.includes("diedru") && c.includes("apotem")) {
    const r = num(new RegExp(`apotem[aă][\\s\\S]{0,25}?${NUM}`));
    const diedru = num(new RegExp(`diedru[\\s\\S]{0,25}?${NUM}`)) ?? num(new RegExp(`${NUM}\\s*(?:°|grade)`));
    if (r && diedru) return { input: { kind: "spec2d", spec: dihedralSection(r, diedru) }, desired: { dim: "2D", orientation: "apex-sus", mustLabels: ["O", "M", "V"], minPolylines: 4 } };
  }

  // ── sferă înscrisă în con → secțiune axială (triunghi isoscel + cerc înscris) ──
  if (c.includes("sfer") && c.includes("înscris") && c.includes("con")) {
    const R = num(new RegExp(`raz[aă][\\s\\S]{0,20}?${NUM}`)), H = num(new RegExp(`[iî]n[aă]l[tț]ime[\\s\\S]{0,20}?${NUM}`));
    if (R && H) {
      const spec = axialSection({ points: [], elements: [{ kind: "cone3d", id: "con", radius: R, height: H }, { kind: "inscribedSphere", in: "con" }] } as unknown as Scene3D);
      return { input: { kind: "spec2d", spec }, desired: { dim: "2D", orientation: "apex-sus", mustLabels: ["V", "B", "C"], minPolylines: 2 } };
    }
  }

  // ── piramidă pe trapez isoscel (baza mică, latura, unghi la baza mare) + muchii laterale EGALE → apex peste circumcentru ──
  if (c.includes("piramid") && c.includes("trapez") && c.includes("isoscel") && c.includes("muchi") && c.includes("lateral")) {
    const small = num(new RegExp(`baz[aă]\\s*mic[aă][\\s\\S]{0,20}?${NUM}`));
    const legM = c.match(/√\s*(\d+(?:[.,]\d+)?)/); const leg = legM ? Math.sqrt(f(legM[1])) : num(new RegExp(`congruente[\\s\\S]{0,20}?${NUM}`));
    const angle = num(new RegExp(`${NUM}\\s*°`)) ?? num(new RegExp(`unghiur[\\s\\S]{0,40}?${NUM}`));
    const edge = num(new RegExp(`muchi[\\s\\S]{0,30}?lateral[\\s\\S]{0,45}?${NUM}`)) ?? num(new RegExp(`lateral[\\s\\S]{0,45}?${NUM}`));
    if (small && leg && angle && edge) {
      const horiz = leg * Math.cos((angle * Math.PI) / 180), big = small + 2 * horiz;
      // Baza reală e aproape plană (proporții extreme) ⇒ proiecția fidelă arată ca un ac. Desenăm pictograma
      // SCHEMATICĂ de manual (bază mare AB în față, bază mică DC în spate, vârf sus) — ca în desenul DORIT.
      // Numărul real (înălțimea) se rezolvă cu CAS-ul metric; figura doar ilustrează.
      return {
        input: { kind: "scene", scene: pyramidTrapezoidScene(small, big) },
        desired: { dim: "3D", orientation: "apex-sus", mustLabels: ["V", "A", "B"], minPolylines: 6 },
      };
    }
  }

  // ── A,B,C pe cerc + D pe dreapta AB, ∠CBD dat → cerc + secantă + coardă + unghi (unghi înscris/exterior) ──
  if (c.includes("cerc") && c.includes("arc") && /∠|unghi/.test(c)) {
    const angle = num(new RegExp(`${NUM}\\s*°`)) ?? num(/cbd[^0-9]{0,8}(\d+)/);
    if (angle) return { input: { kind: "spec2d", spec: circleSecantAngle(angle) }, desired: { dim: "2D", mustLabels: ["A", "B", "C", "D"], minPolylines: 2 } };
  }

  // ── trapez isoscel CIRCUMSCRIPTIBIL (tangențial) 2D + cerc înscris (bazele date) ──
  if (c.includes("trapez") && c.includes("circumscriptibil")) {
    const b1 = num(/bc\s*=\s*(\d+(?:[.,]\d+)?)/), b2 = num(/ad\s*=\s*(\d+(?:[.,]\d+)?)/);
    if (b1 && b2) {
      const big = Math.max(b1, b2), small = Math.min(b1, b2);
      const leg = (big + small) / 2, h = Math.sqrt(leg * leg - ((big - small) / 2) ** 2), r = h / 2;
      // ABCD: A,D pe baza mare (jos); B,C pe baza mică (sus). AB, CD = laturile.
      const A = -big / 2, D = big / 2, Bx = -small / 2, Cx = small / 2;
      const spec: FigureSpec2D = {
        points: [{ id: "A", x: A, y: 0, label: "A" }, { id: "B", x: Bx, y: h, label: "B" }, { id: "C", x: Cx, y: h, label: "C" }, { id: "D", x: D, y: 0, label: "D" }, { id: "O", x: 0, y: r, label: "O" }],
        elements: [{ kind: "polygon", points: ["A", "B", "C", "D"] }, { kind: "circle", center: "O", radius: r, centerLabel: "O" }],
      };
      return { input: { kind: "spec2d", spec }, desired: { dim: "2D", mustLabels: ["A", "B", "C", "D"], minPolylines: 2 } };
    }
  }

  // ── piramidă patrulateră regulată (volum + aria bazei) → pictogramă 3D ──
  if (c.includes("piramid") && c.includes("patrulater") && c.includes("regulat")) {
    const V = num(new RegExp(`${NUM}\\s*cm\\s*3`)), area = num(new RegExp(`${NUM}\\s*cm\\s*2`)); // cm3 = volum, cm2 = arie
    if (V && area) {
      const baseEdge = Math.sqrt(area), height = (3 * V) / area;
      return { input: { kind: "body3d", body: { kind: "regularPyramid", baseSides: 4, baseEdge, height } }, desired: { dim: "3D", orientation: "apex-sus", mustLabels: ["V"], minPolylines: 6 } };
    }
  }

  // ── romb AMNP înscris în triunghi (cu A vârf comun) ──
  if (c.includes("romb") && c.includes("triunghi") && c.includes("amnp")) {
    // textul lipit poate fi corupt (𝐴𝐶 → „�"), deci iau cele 3 lungimi „= N cm" în ordine (AB, AC, BC)
    const seq = [...c.matchAll(/=\s*(\d+(?:[.,]\d+)?)\s*cm/g)].map((m) => f(m[1]));
    const AB = num(/ab\s*=\s*(\d+(?:[.,]\d+)?)/) ?? seq[0], AC = num(/ac\s*=\s*(\d+(?:[.,]\d+)?)/) ?? seq[1], BC = num(/bc\s*=\s*(\d+(?:[.,]\d+)?)/) ?? seq[2];
    if (AB && AC && BC) {
      const s = (AC * AB) / (AB + AC), t = AB / (AB + AC); // latura rombului + parametrul pe BC
      const problem: GeoProblem = {
        build: [
          { op: "triangleSSS", ids: ["A", "B", "C"], ab: AB, bc: BC, ca: AC },
          { op: "onSegment", id: "M", seg: ["A", "B"], dist: s },
          { op: "onSegment", id: "P", seg: ["A", "C"], dist: s },
          { op: "onSegment", id: "N", seg: ["B", "C"], ratio: t },
        ],
        givens: [{ kind: "length", of: ["A", "B"], value: AB }, { kind: "length", of: ["A", "C"], value: AC }, { kind: "length", of: ["B", "C"], value: BC }, { kind: "length", of: ["A", "M"], value: s }, { kind: "length", of: ["M", "N"], value: s }],
        draw: { polygons: [["A", "B", "C"], ["A", "M", "N", "P"]] },
      };
      return { input: { kind: "geo", problem }, desired: { dim: "2D", mustLabels: ["A", "B", "C", "M", "N", "P"], minPolylines: 2 } };
    }
  }

  // ── triunghi isoscel (baza BC), bisectoarea BD pe AC cu AD, DC → + înălțimea din A pe BC ──
  if (c.includes("isoscel") && c.includes("bisectoarea") && /ad\s*=/.test(c) && /dc\s*=/.test(c)) {
    const AD = num(/ad\s*=\s*(\d+(?:[.,]\d+)?)/), DC = num(/dc\s*=\s*(\d+(?:[.,]\d+)?)/);
    if (AD && DC) {
      const AB = AD + DC, BC = (AB * DC) / AD; // AB=AC=AD+DC; bisectoare din B: AD/DC=AB/BC
      return {
        input: { kind: "geo", problem: {
          build: [
            { op: "triangleSSS", ids: ["A", "B", "C"], ab: AB, bc: BC, ca: AB },
            { op: "bisectorFoot", id: "D", tri: ["A", "B", "C"], from: "B" },
            { op: "foot", id: "H", from: "A", to: ["B", "C"] },
          ],
          givens: [{ kind: "length", of: ["A", "B"], value: AB }, { kind: "length", of: ["C", "A"], value: AB }, { kind: "length", of: ["B", "C"], value: BC }, { kind: "length", of: ["A", "D"], value: AD }, { kind: "rightAngle", at: "H", rays: ["A", "B"] }],
        } },
        desired: { dim: "2D", mustLabels: ["A", "B", "C", "D", "H"], minPolylines: 3 },
      };
    }
  }

  // ── triunghi isoscel cu bisectoarea dintr-un vârf (AB=AC=L) → triangleSSS + bisectorFoot din A ──
  if (c.includes("triunghi") && c.includes("bisectoare") && /ab\s*=\s*ac\s*=/.test(c)) {
    const m = c.match(/ab\s*=\s*ac\s*=\s*(\d+(?:[.,]\d+)?)/), bc = num(/bc\s*=\s*(\d+(?:[.,]\d+)?)/);
    if (m && bc) {
      const L = f(m[1]);
      return {
        input: { kind: "geo", problem: { build: [{ op: "triangleSSS", ids: ["A", "B", "C"], ab: L, bc, ca: L }, { op: "bisectorFoot", id: "M", tri: ["A", "B", "C"], from: "A" }], givens: [{ kind: "length", of: ["A", "B"], value: L }, { kind: "length", of: ["A", "C"], value: L }, { kind: "length", of: ["B", "C"], value: bc }] } },
        desired: { dim: "2D", mustLabels: ["A", "B", "C", "M"], minPolylines: 2 },
      };
    }
  }

  // ── FALLBACK: solid standard (cub/prismă/piramidă/tetraedru/paralelipiped/trunchi/con/cilindru/sferă) ──
  return standardSolid(c);
}
