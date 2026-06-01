"use client";

import { useEffect, useRef, useState } from "react";
import { solvePyramid, type FigureSpec3D } from "@/lib/figures/spec3d";

/* eslint-disable @typescript-eslint/no-explicit-any -- punte către JSXGraph view3d (lib fără tipuri ESM stricte) */

const INK = "#1a1a1a";
const labelOf = (color: string) => ({ fontSize: 16, strokeColor: color, cssStyle: "font-family:Georgia,'Times New Roman',serif;font-style:italic;" });

/** Construiește piramida în view3d din coordonatele REZOLVATE (corect prin construcție). */
function buildPyramid(view: any, spec: FigureSpec3D) {
  const s = solvePyramid(spec.body);
  const show = { height: true, dihedral: true, ...spec.show };

  // Corp: fețe translucide cu muchii (depthOrder ordonează fețele → ocluzie corectă).
  view.create("polyhedron3d", [s.verts.map((v) => v.xyz), s.faces], {
    fillColor: "#cbd5e1", fillOpacity: 0.28, strokeColor: INK, strokeWidth: 1.4, layer: 10,
  });

  // Vârfuri etichetate (deasupra corpului).
  const pt = (xyz: number[], name: string, color = INK) =>
    view.create("point3d", xyz, { name, size: 2, fillColor: color, strokeColor: color, withLabel: true, label: labelOf(color), fixed: true });
  const vp: Record<string, any> = {};
  for (const v of s.verts) vp[v.id] = pt(v.xyz, v.id);

  const seg = (a: any, b: any, color: string, dash = 0) =>
    view.create("line3d", [a, b], { straightFirst: false, straightLast: false, strokeColor: color, strokeWidth: 1.3, dash, fixed: true });

  // Înălțimea VO (punctată).
  if (show.height) {
    const O = pt(s.center as number[], "O", INK);
    seg(vp[s.apexId], O, INK, 2);
    // Unghiul diedru: M = mijlocul unei laturi de bază; OM (apotemă) + VM (apotema feței).
    if (show.dihedral) {
      const M = pt(s.apothemFoot as number[], "M", "#dc2626");
      seg(O, M, "#dc2626", 2);            // apotema bazei
      seg(vp[s.apexId], M, "#dc2626", 0); // apotema feței (înălțimea feței)
      const lift: number[] = [s.apothemFoot[0] * 1.15, s.apothemFoot[1] * 1.15, s.apothem * 0.18];
      view.create("text3d", [lift, `φ ≈ ${s.dihedralDeg.toFixed(0)}°`], { fontSize: 14, strokeColor: "#dc2626" });
    }
  }
  return s;
}

export interface Figure3DRendererProps { spec: FigureSpec3D; size?: number; className?: string }

/**
 * Randează o FigureSpec3D cu JSXGraph view3d (NATIV), client-side, interactiv (rotație prin trackball).
 * Corpul e calculat din parametri (solvePyramid), nu plasat de mână.
 */
export default function Figure3DRenderer({ spec, size = 460, className }: Figure3DRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ dihedral: number; apothem: number; circumR: number } | null>(null);

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

        const s0 = solvePyramid(spec.body);
        const E = s0.extent;
        board = JXG.JSXGraph.initBoard(containerRef.current, {
          boundingbox: [-8, 8, 8, -8], keepaspectratio: true, axis: false, grid: false,
          showCopyright: false, showNavigation: false, pan: { enabled: false }, zoom: { enabled: false },
        });
        const view = board.create("view3d", [[-7, -6.5], [14, 14], [[-E, E], [-E, E], [-E, E]]], {
          projection: "parallel",
          trackball: { enabled: true },        // rotație interactivă prin drag
          depthOrder: { enabled: true },        // ordonare fețe → ocluzie corectă
          xPlaneRear: { visible: false }, yPlaneRear: { visible: false }, zPlaneRear: { visible: false },
          xPlaneFront: { visible: false }, yPlaneFront: { visible: false }, zPlaneFront: { visible: false },
        });

        const s = buildPyramid(view, spec);
        board.update();
        if (!cancelled) setInfo({ dihedral: s.dihedralDeg, apothem: s.apothem, circumR: s.circumR });
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
      {info && (
        <div className="mt-1 text-xs text-gray-500">
          trage cu mouse-ul pentru rotație · unghi diedru calculat <strong>{info.dihedral.toFixed(1)}°</strong> · apotemă {info.apothem.toFixed(1)} · rază bază {info.circumR.toFixed(1)}
        </div>
      )}
    </div>
  );
}
