/**
 * ETAPA 46 — EXTRACȚIA pe care o furnizează Claude Code (abonament, NU API în app) pentru coada de autorat.
 * Mapează condiția (text liber din web) la intrarea de pipeline (relații + numere, ZERO coordonate).
 * Necunoscut → null (cazul rămâne marcat „extracție necesară"); adaug aici clasa nouă când o întâlnesc.
 */
import type { PipelineInput, DesiredDescriptor } from "../../src/lib/figures/authoring";
import { axialSection, dihedralSection } from "../../src/lib/figures/axial";
import type { Scene3D } from "../../src/lib/figures/spec3d";

type Resolved = { input: PipelineInput; desired?: DesiredDescriptor };
const NUM = "(\\d+(?:[.,]\\d+)?)";
const f = (s: string): number => parseFloat(s.replace(",", "."));

export function resolveInput(condition: string): Resolved | null {
  const c = condition.toLowerCase();
  const num = (re: RegExp): number | null => { const m = c.match(re); return m ? f(m[1]) : null; };

  // ── con + plan paralel cu baza la o distanță de vârf → secțiune (distanță punct–plan = perpendiculara) ──
  if (c.includes("con") && c.includes("plan") && (c.includes("vârf") || c.includes("varf"))) {
    // tolerează frazări variate + π (U+03C0) SAU 𝜋 (U+1D70B) + newline-uri (`[\s\S]` non-greedy)
    const H = num(new RegExp(`[iî]n[aă]l[tț]ime[\\s\\S]{0,40}?${NUM}`));
    const volCoef = num(new RegExp(`${NUM}\\s*(?:π|𝜋)`));
    const dist = num(new RegExp(`distan[tț]a[\\s\\S]{0,30}?${NUM}`));
    if (H && volCoef && dist) {
      const R = Math.sqrt((3 * volCoef) / H); // V=(1/3)πR²H, V=volCoef·π ⇒ R=√(3·volCoef/H)
      return {
        input: { kind: "coneCut", cone: { radius: R, height: H }, by: { rel: "distanceApexToParallelPlane", value: dist } },
        desired: { dim: "3D", orientation: "apex-sus", mustLabels: ["V", "O", String(dist)], minPolylines: 6 },
      };
    }
  }

  // ── piramidă cu apotema bazei + unghi diedru la bază → secțiune triunghi dreptunghic VOM ──
  if (c.includes("diedru") && c.includes("apotem")) {
    const r = num(new RegExp(`apotem[aă][\\s\\S]{0,25}?${NUM}`));
    const diedru = num(new RegExp(`diedru[\\s\\S]{0,25}?${NUM}`)) ?? num(new RegExp(`${NUM}\\s*(?:°|grade)`));
    if (r && diedru) {
      return { input: { kind: "spec2d", spec: dihedralSection(r, diedru) }, desired: { dim: "2D", orientation: "apex-sus", mustLabels: ["O", "M", "V"], minPolylines: 4 } };
    }
  }

  // ── sferă înscrisă în con → secțiune axială (triunghi isoscel + cerc înscris) ──
  if (c.includes("sfer") && c.includes("înscris") && c.includes("con")) {
    const R = num(new RegExp(`raz[aă][\\s\\S]{0,20}?${NUM}`));
    const H = num(new RegExp(`[iî]n[aă]l[tț]ime[\\s\\S]{0,20}?${NUM}`));
    if (R && H) {
      const spec = axialSection({ points: [], elements: [{ kind: "cone3d", id: "con", radius: R, height: H }, { kind: "inscribedSphere", in: "con" }] } as unknown as Scene3D);
      return { input: { kind: "spec2d", spec }, desired: { dim: "2D", orientation: "apex-sus", mustLabels: ["V", "B", "C"], minPolylines: 2 } };
    }
  }

  // ── triunghi isoscel cu bisectoarea dintr-un vârf → triangleSSS + bisectorFoot ──
  if (c.includes("triunghi") && c.includes("bisectoare")) {
    const eq = c.match(new RegExp(`ab\\s*=\\s*ac\\s*=\\s*${NUM}`)); // isoscel AB=AC=L
    const bc = num(new RegExp(`bc\\s*=\\s*${NUM}`));
    if (eq && bc) {
      const L = f(eq[1]);
      return {
        input: { kind: "geo", problem: { build: [{ op: "triangleSSS", ids: ["A", "B", "C"], ab: L, bc, ca: L }, { op: "bisectorFoot", id: "M", tri: ["A", "B", "C"], from: "A" }], givens: [{ kind: "length", of: ["A", "B"], value: L }, { kind: "length", of: ["A", "C"], value: L }, { kind: "length", of: ["B", "C"], value: bc }] } },
        desired: { dim: "2D", mustLabels: ["A", "B", "C", "M"], minPolylines: 2 },
      };
    }
  }

  return null;
}
