/**
 * ETAPA 40 — OPERATORI GENERALI de figură (înlocuiesc handlerele per-problemă).
 *
 * axialSection: scenă 3D de corpuri de ROTAȚIE + plan axial → figura 2D (fiecare element își dă secțiunea:
 *   con→triunghi isoscel, sferă→cerc, sferă înscrisă→cercul ÎNSCRIS al triunghiului conului, cilindru→dreptunghi,
 *   segment auxiliar→segment). COMPUNE secțiunile, la ORICE cifre/compoziție, FĂRĂ cod nou per problemă.
 * dihedralSection: apotemă r + unghi diedru → triunghiul dreptunghic VOM (secțiunea perpendiculară pe muchie).
 */
import { solveScenePoints, type Scene3D, type Vec3 } from "./spec3d";
import type { FigureSpec2D, FigureElement, FigurePoint } from "./spec";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Secțiune axială a unei scene de corpuri de rotație → FigureSpec2D (x = rază, y = înălțime z). */
export function axialSection(scene: Scene3D): FigureSpec2D {
  const pts3 = solveScenePoints(scene);
  const base = (ref?: string | Vec3): Vec3 => (Array.isArray(ref) ? ref : (typeof ref === "string" && pts3[ref]) ? pts3[ref] : [0, 0, 0]);
  const points: FigurePoint[] = [];
  const elements: FigureElement[] = [];
  const coneTri = new Map<string, [string, string, string]>();
  let n = 0;
  const addPt = (x: number, y: number, label?: string): string => {
    const id = label && !points.some((p) => p.id === label) ? label : `s${n++}`;
    points.push({ id, x, y, label });
    return id;
  };

  // 1) Conurile întâi (ca sfera înscrisă să refere triunghiul lor).
  let coneCount = 0;
  for (const e of scene.elements) {
    if (e.kind !== "cone3d") continue;
    const c = base(e.baseCenter), z0 = c[2], R = e.radius, H = e.height;
    const suffix = coneCount++ ? String(coneCount) : "";
    const V = addPt(c[0], z0 + H, `V${suffix}`), B = addPt(c[0] - R, z0, `B${suffix}`), C = addPt(c[0] + R, z0, `C${suffix}`);
    elements.push({ kind: "polygon", points: [V, B, C] });
    const tri: [string, string, string] = [V, B, C];
    if (e.id) coneTri.set(e.id, tri);
    coneTri.set("__last", tri);
  }
  // 2) Restul elementelor.
  for (const e of scene.elements) {
    if (e.kind === "cone3d") continue;
    if (e.kind === "cylinder3d") {
      const c = base(e.baseCenter), z0 = c[2], R = e.radius, H = e.height;
      const a = addPt(c[0] - R, z0), b = addPt(c[0] + R, z0), cc = addPt(c[0] + R, z0 + H), d = addPt(c[0] - R, z0 + H);
      elements.push({ kind: "polygon", points: [a, b, cc, d] });
    } else if (e.kind === "sphere3d") {
      const c = base(e.center);
      const O = addPt(c[0], c[2], "O");
      elements.push({ kind: "circle", center: O, radius: e.radius, centerLabel: "O" });
    } else if (e.kind === "inscribedSphere") {
      const tri = (e.in && coneTri.get(e.in)) || coneTri.get("__last");
      if (tri) elements.push({ kind: "incircle", of: tri, centerLabel: "O" }); // cercul înscris = secțiunea sferei tangente
    } else if (e.kind === "segment3d") {
      const a = base(e.of[0]), b = base(e.of[1]);
      const ia = addPt(a[0], a[2]), ib = addPt(b[0], b[2]);
      elements.push({ kind: "segment", between: [ia, ib] });
    }
  }
  return { points, elements };
}

/** Secțiunea pentru unghiul diedru la baza piramidei: triunghi dreptunghic VOM (OM=r, OV=H, ∠M=diedru). */
export function dihedralSection(apothem: number, dihedralDeg: number): FigureSpec2D {
  const r = apothem;
  const H = r * Math.tan((dihedralDeg * Math.PI) / 180);
  return {
    points: [{ id: "O", x: 0, y: 0, label: "O" }, { id: "M", x: r, y: 0, label: "M" }, { id: "V", x: 0, y: H, label: "V" }],
    elements: [
      { kind: "segment", between: ["O", "M"], label: `r=${r2(r)}` },
      { kind: "segment", between: ["O", "V"], label: "H" },
      { kind: "segment", between: ["M", "V"] },
      { kind: "rightAngle", at: "O", from: ["M", "V"] },
      { kind: "angle", at: "M", from: ["O", "V"], label: `${r2(dihedralDeg)}°` },
    ],
  };
}
