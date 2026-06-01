"use client";

import { useEffect, useRef, useState } from "react";
import { solvePyramid, solvePerpFromVertex, solvePolyhedron, bodyExtent, solveScenePoints, sceneExtent, type FigureSpec3D, type RegularPyramidSpec, type PerpFromVertexSpec, type PolyhedronBody, type ConeSpec, type CylinderSpec, type SphereSpec, type Scene3D, type Vec3 } from "@/lib/figures/spec3d";

/* eslint-disable @typescript-eslint/no-explicit-any -- punte către JSXGraph view3d (lib fără tipuri ESM stricte) */

const INK = "#1a1a1a";
const RED = "#dc2626";
const labelOf = (color: string) => ({ fontSize: 16, strokeColor: color, cssStyle: "font-family:Georgia,'Times New Roman',serif;font-style:italic;" });
const unit = (a: number[], b: number[]) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(d[0], d[1], d[2]) || 1; return d.map((x) => x / L); };

function helpers(view: any) {
  const pt = (xyz: number[], name: string, color = INK) =>
    view.create("point3d", xyz, { name, size: 2, fillColor: color, strokeColor: color, withLabel: !!name, label: labelOf(color), fixed: true });
  const seg = (a: any, b: any, color: string, dash = 0) =>
    view.create("line3d", [a, b], { straightFirst: false, straightLast: false, strokeColor: color, strokeWidth: 1.3, dash, fixed: true });
  // pătrățel de unghi drept la P, în planul (u,v).
  const sq = (P: number[], u: number[], v: number[], color: string, e: number) => {
    const a = unit([0, 0, 0], u), b = unit([0, 0, 0], v);
    const c1 = [P[0] + a[0] * e, P[1] + a[1] * e, P[2] + a[2] * e];
    const c2 = [P[0] + (a[0] + b[0]) * e, P[1] + (a[1] + b[1]) * e, P[2] + (a[2] + b[2]) * e];
    const c3 = [P[0] + b[0] * e, P[1] + b[1] * e, P[2] + b[2] * e];
    view.create("line3d", [c1, c2], { straightFirst: false, straightLast: false, strokeColor: color, strokeWidth: 1, fixed: true });
    view.create("line3d", [c2, c3], { straightFirst: false, straightLast: false, strokeColor: color, strokeWidth: 1, fixed: true });
  };
  return { pt, seg, sq };
}

/** Piramidă regulată: corp + înălțime VO + unghi diedru (calculat). */
function buildPyramid(view: any, body: RegularPyramidSpec, show: { height?: boolean; dihedral?: boolean }): string {
  const s = solvePyramid(body);
  const sh = { height: true, dihedral: true, ...show };
  view.create("polyhedron3d", [s.verts.map((v) => v.xyz), s.faces], { fillColor: "#cbd5e1", fillOpacity: 0.28, strokeColor: INK, strokeWidth: 1.4, layer: 10 });
  const { pt, seg } = helpers(view);
  const vp: Record<string, any> = {};
  for (const v of s.verts) vp[v.id] = pt(v.xyz, v.id);
  if (sh.height) {
    const O = pt(s.center as number[], "O", INK);
    seg(vp[s.apexId], O, INK, 2);
    if (sh.dihedral) {
      const M = pt(s.apothemFoot as number[], "M", RED);
      seg(O, M, RED, 2); seg(vp[s.apexId], M, RED, 0);
      const Mc = s.apothemFoot, u1 = unit(Mc, s.center), u2 = unit(Mc, s.verts[0].xyz);
      let bis = [u1[0] + u2[0], u1[1] + u2[1], u1[2] + u2[2]]; const Lb = Math.hypot(bis[0], bis[1], bis[2]) || 1; bis = bis.map((x) => x / Lb);
      const r = s.apothem * 0.42;
      view.create("text3d", [[Mc[0] + bis[0] * r, Mc[1] + bis[1] * r, Mc[2] + bis[2] * r], `φ ≈ ${s.dihedralDeg.toFixed(0)}°`], { fontSize: 14, strokeColor: RED });
      void M;
    }
  }
  return `unghi diedru calculat ${s.dihedralDeg.toFixed(1)}° · apotemă ${s.apothem.toFixed(1)} · rază bază ${s.circumR.toFixed(1)}`;
}

/** Triunghi în plan + perpendiculară pe plan dintr-un vârf (3 perpendiculare / distanță la o dreaptă). */
function buildPerp(view: any, body: PerpFromVertexSpec): string {
  const s = solvePerpFromVertex(body);
  const coord = (id: string) => s.verts.find((v) => v.id === id)!.xyz;
  view.create("polyhedron3d", [s.verts.slice(0, 3).map((v) => v.xyz), [[0, 1, 2]]], { fillColor: "#cbd5e1", fillOpacity: 0.25, strokeColor: INK, strokeWidth: 1.4, layer: 10 });
  const { pt, seg, sq } = helpers(view);
  const vp: Record<string, any> = {};
  for (const v of s.verts) vp[v.id] = pt(v.xyz, v.id, v.id === s.apexId ? RED : v.id === s.footId ? "#2563eb" : INK);

  const A = coord(s.apexBaseId), M = coord(s.apexId), D = coord(s.footId);
  const E0 = coord(s.oppositeEdge[0]), E1 = coord(s.oppositeEdge[1]);
  seg(vp[s.apexBaseId], vp[s.apexId], INK, 0);   // perpendiculara pe plan (AM)
  seg(vp[s.apexBaseId], vp[s.footId], "#94a3b8", 2); // AD în plan (punctat)
  seg(vp[s.apexId], vp[s.footId], "#2563eb", 0); // distanța MD (evidențiată)
  const e = s.extent * 0.05;
  sq(A, unit(A, M), unit(A, D), INK, e);          // unghi drept AM ⟂ AD
  sq(D, unit(D, M), unit(D, E1), "#2563eb", e);   // unghi drept MD ⟂ BC
  // eticheta distanței, lângă mijlocul lui MD
  const mid = [(M[0] + D[0]) / 2, (M[1] + D[1]) / 2, (M[2] + D[2]) / 2];
  const off = unit(D, E0); // ușor de-a lungul laturii ca să nu calce segmentul
  view.create("text3d", [[mid[0] + off[0] * e * 1.5, mid[1] + off[1] * e * 1.5, mid[2] + off[2] * e * 1.5], `d(${s.apexId},${s.oppositeEdge.join("")}) = ${s.distanceMD.toFixed(2)}`], { fontSize: 13, strokeColor: "#2563eb" });
  void E1;
  return `distanța de la ${s.apexId} la ${s.oppositeEdge.join("")} = ${s.distanceMD.toFixed(2)} · înălțime ${s.apexHeight}`;
}

/** Corpuri poliedrale: cub, paralelipiped, prismă, tetraedru, trunchi de piramidă. */
function buildPolyhedron(view: any, body: PolyhedronBody): string {
  const s = solvePolyhedron(body);
  view.create("polyhedron3d", [s.verts.map((v) => v.xyz), s.faces], { fillColor: "#cbd5e1", fillOpacity: 0.26, strokeColor: INK, strokeWidth: 1.4, layer: 10 });
  const { pt } = helpers(view);
  for (const v of s.verts) pt(v.xyz, v.id);
  return s.info;
}

/** Con: cerc de bază + vârf + generatoare (înălțime punctată). */
function buildCone(view: any, body: ConeSpec): string {
  const { radius: r, height: h } = body;
  if (!(r > 0) || !(h > 0)) throw new Error("con: radius și height pozitive.");
  const z0 = -h / 2, z1 = h / 2;
  view.create("circle3d", [[0, 0, z0], [0, 0, 1], r], { strokeColor: INK, strokeWidth: 1.4, fillColor: "#cbd5e1", fillOpacity: 0.22 });
  const { pt, seg } = helpers(view);
  const V = pt([0, 0, z1], "V", INK), O = pt([0, 0, z0], "O", INK);
  const A = pt([r, 0, z0], "A", INK), B = pt([-r, 0, z0], "B", INK);
  seg(V, A, INK, 0); seg(V, B, INK, 0);       // generatoare
  seg(V, O, INK, 2);                          // înălțimea (punctată)
  seg(O, A, "#94a3b8", 2);                    // raza
  return `con: rază ${r}, înălțime ${h}, generatoare ${Math.hypot(r, h).toFixed(2)}`;
}

/** Cilindru: două cercuri (bazele) + generatoare. */
function buildCylinder(view: any, body: CylinderSpec): string {
  const { radius: r, height: h } = body;
  if (!(r > 0) || !(h > 0)) throw new Error("cilindru: radius și height pozitive.");
  const z0 = -h / 2, z1 = h / 2;
  for (const z of [z0, z1]) view.create("circle3d", [[0, 0, z], [0, 0, 1], r], { strokeColor: INK, strokeWidth: 1.4, fillColor: "#cbd5e1", fillOpacity: 0.18 });
  const { pt, seg } = helpers(view);
  const A = pt([r, 0, z0], "A", INK), A1 = pt([r, 0, z1], "A'", INK);
  const B = pt([-r, 0, z0], "B", INK), B1 = pt([-r, 0, z1], "B'", INK);
  seg(A, A1, INK, 0); seg(B, B1, INK, 0);      // generatoare
  seg(pt([0, 0, z0], "O", INK), A, "#94a3b8", 2);
  return `cilindru: rază ${r}, înălțime ${h}`;
}

/** Sferă (nativ) + cerc mare (ecuator) + centru. */
function buildSphere(view: any, body: SphereSpec): string {
  const r = body.radius;
  if (!(r > 0)) throw new Error("sferă: radius pozitiv.");
  view.create("sphere3d", [[0, 0, 0], r], { strokeColor: INK, strokeWidth: 1, fillColor: "#cbd5e1", fillOpacity: 0.2 });
  view.create("circle3d", [[0, 0, 0], [0, 0, 1], r], { strokeColor: INK, strokeWidth: 1, dash: 2, fillOpacity: 0 });
  const { pt, seg } = helpers(view);
  const O = pt([0, 0, 0], "O", INK), A = pt([r, 0, 0], "A", INK);
  seg(O, A, "#94a3b8", 2); // raza
  return `sferă: rază ${r}, aria ${(4 * Math.PI * r * r).toFixed(2)}, volum ${((4 / 3) * Math.PI * r ** 3).toFixed(2)}`;
}

/** Scenă GENERALĂ: puncte din constrângeri + poliedru(vârfuri,fețe) + suprafețe + relații. */
function buildScene(view: any, scene: Scene3D): string {
  const pts = solveScenePoints(scene);
  const { pt, seg } = helpers(view);
  const vp: Record<string, any> = {};
  for (const [id, xyz] of Object.entries(pts)) vp[id] = pt(xyz, id);
  // Referință de PLASARE: Vec3 → ea; id existent → punctul; lipsă/nerezolvat → ORIGINEA (niciodată undefined).
  const coord = (ref?: string | Vec3): Vec3 => {
    if (Array.isArray(ref)) return ref;
    if (typeof ref === "string" && pts[ref]) return pts[ref];
    return [0, 0, 0];
  };
  // Referință STRUCTURALĂ (vârf de poliedru/segment): trebuie să existe.
  const needPt = (id: string): any => { const p = vp[id]; if (!p) throw new Error(`punctul „${id}” e nedefinit în scenă.`); return p; };
  const circle = (c: Vec3, r: number, fill: number) => view.create("circle3d", [c, [0, 0, 1], r], { strokeColor: INK, strokeWidth: 1.4, fillColor: "#cbd5e1", fillOpacity: fill });
  const notes: string[] = [];

  for (const e of scene.elements) {
    if (e.kind === "polyhedron") {
      const missing = e.vertices.filter((v) => !pts[v]);
      if (missing.length) throw new Error(`poliedru: vârf(uri) nedefinit(e): ${missing.join(", ")}`);
      const idx = new Map(e.vertices.map((v, i) => [v, i]));
      view.create("polyhedron3d", [e.vertices.map((v) => pts[v]), e.faces.map((f) => f.map((v) => idx.get(v)!))],
        { fillColor: "#cbd5e1", fillOpacity: e.fillOpacity ?? 0.26, strokeColor: INK, strokeWidth: 1.4, layer: 10 });
    } else if (e.kind === "sphere3d") {
      view.create("sphere3d", [coord(e.center ?? [0, 0, 0]), e.radius], { strokeColor: INK, strokeWidth: 1, fillColor: "#cbd5e1", fillOpacity: 0.2 });
    } else if (e.kind === "cone3d") {
      const c = coord(e.baseCenter ?? [0, 0, 0]);
      circle(c, e.radius, 0.22);
      const V = pt([c[0], c[1], c[2] + e.height], "V"); const A = pt([c[0] + e.radius, c[1], c[2]], "A"); const B = pt([c[0] - e.radius, c[1], c[2]], "B");
      seg(V, A, INK, 0); seg(V, B, INK, 0); seg(V, pt(c, "O"), INK, 2);
      notes.push(`con r=${e.radius} h=${e.height}`);
    } else if (e.kind === "cylinder3d") {
      const c = coord(e.baseCenter ?? [0, 0, 0]);
      circle(c, e.radius, 0.18); circle([c[0], c[1], c[2] + e.height], e.radius, 0.18);
      seg(pt([c[0] + e.radius, c[1], c[2]], "A"), pt([c[0] + e.radius, c[1], c[2] + e.height], "A'"), INK, 0);
      seg(pt([c[0] - e.radius, c[1], c[2]], "B"), pt([c[0] - e.radius, c[1], c[2] + e.height], "B'"), INK, 0);
      notes.push(`cilindru r=${e.radius} h=${e.height}`);
    } else if (e.kind === "inscribedSphere") {
      const { radius: R, height: H } = e.inCone; const L = Math.hypot(R, H); const rho = (R * H) / (R + L);
      const c = coord(e.baseCenter ?? [0, 0, 0]);
      view.create("sphere3d", [[c[0], c[1], c[2] + rho], rho], { strokeColor: "#dc2626", strokeWidth: 1, fillColor: "#fecaca", fillOpacity: 0.3 });
      view.create("text3d", [[c[0], c[1], c[2] + rho], `ρ = ${rho.toFixed(2)}`], { fontSize: 13, strokeColor: "#dc2626" });
      notes.push(`sferă înscrisă ρ=${rho.toFixed(2)}`);
    } else if (e.kind === "segment3d") {
      seg(needPt(e.of[0]), needPt(e.of[1]), e.color ?? INK, e.dash ? 2 : 0);
    } else if (e.kind === "label3d") {
      view.create("text3d", [coord(e.at), e.text], { fontSize: 13, strokeColor: INK });
    }
  }
  return notes.length ? `scenă compusă · ${notes.join(" · ")}` : "scenă 3D compusă din primitive";
}

export interface Figure3DRendererProps { spec: FigureSpec3D; size?: number; className?: string }

/** Randează o FigureSpec3D cu JSXGraph view3d (NATIV), client-side, rotație prin barele az/el. */
export default function Figure3DRenderer({ spec, size = 460, className }: Figure3DRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let board: any = null;
    let JXGref: any = null;
    let cancelled = false;

    (async () => {
      try {
        const mod: any = await import("jsxgraph");
        const JXG = mod.default ?? mod;
        JXGref = JXG;
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";

        const E = spec.scene ? sceneExtent(spec.scene) : bodyExtent(spec.body!);
        board = JXG.JSXGraph.initBoard(containerRef.current, {
          boundingbox: [-9, 9, 9, -9], keepaspectratio: true, axis: false, grid: false,
          showCopyright: false, showNavigation: false, pan: { enabled: false }, zoom: { enabled: false },
        });
        const view = board.create("view3d", [[-6.5, -5], [13, 13], [[-E, E], [-E, E], [-E, E]]], {
          projection: "parallel",
          trackball: { enabled: false },
          az: { slider: { visible: true, start: 1.0 } },
          el: { slider: { visible: true, start: 0.3 } },
          depthOrder: { enabled: true },
          xPlaneRear: { visible: false }, yPlaneRear: { visible: false }, zPlaneRear: { visible: false },
          xPlaneFront: { visible: false }, yPlaneFront: { visible: false }, zPlaneFront: { visible: false },
        });

        let n: string;
        if (spec.scene) {
          n = buildScene(view, spec.scene);
        } else {
          const body = spec.body!;
          switch (body.kind) {
            case "regularPyramid": n = buildPyramid(view, body, spec.show ?? {}); break;
            case "perpFromVertex": n = buildPerp(view, body); break;
            case "cone": n = buildCone(view, body); break;
            case "cylinder": n = buildCylinder(view, body); break;
            case "sphere": n = buildSphere(view, body); break;
            default: n = buildPolyhedron(view, body); break; // cube/box/prism/tetrahedron/frustum
          }
        }
        board.update();
        if (!cancelled) setNote(n);
      } catch (err) {
        if (!cancelled) setError((err as Error)?.message ?? String(err));
      }
    })();

    return () => {
      cancelled = true;
      try { if (board && JXGref?.JSXGraph?.freeBoard) JXGref.JSXGraph.freeBoard(board); } catch { /* noop */ }
    };
  }, [spec]);

  if (error) {
    return (
      <div className={className}>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Eroare la randarea 3D: {error}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: size, height: size, background: "transparent", touchAction: "none" }} className="rounded border border-gray-200" />
      {note && <div className="mt-1 text-xs text-gray-500">barele az/el rotesc figura · {note}</div>}
    </div>
  );
}
