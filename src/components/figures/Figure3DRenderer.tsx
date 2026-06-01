"use client";

import { useEffect, useRef, useState } from "react";
import { solvePyramid, solvePerpFromVertex, type FigureSpec3D, type RegularPyramidSpec, type PerpFromVertexSpec } from "@/lib/figures/spec3d";

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

        const body = spec.body;
        const E = body.kind === "perpFromVertex" ? solvePerpFromVertex(body).extent : solvePyramid(body).extent;
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

        const n = body.kind === "perpFromVertex" ? buildPerp(view, body) : buildPyramid(view, body, spec.show ?? {});
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
