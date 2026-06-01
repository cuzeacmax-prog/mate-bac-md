"use client";

import { useEffect, useRef, useState } from "react";
import { autoBoundingBox, solveBasePoints, frameSolved, type FigureSpec2D, type LineRef, type SolvedPoint } from "@/lib/figures/spec";

/* eslint-disable @typescript-eslint/no-explicit-any -- punte către JSXGraph (lib fără tipuri ESM stricte) */

type AnyMap = Record<string, any>;
export type FigureStyle = "bac" | "geogebra";

// ── Teme de PREZENTARE (nu ating geometria) ──────────────────────────────────
interface Theme { ink: string; lw: number; fill: number; ptSize: number; colors: boolean; serif: boolean; angleFill: number; bac: boolean }
const THEMES: Record<FigureStyle, Theme> = {
  geogebra: { ink: "#0f172a", lw: 2, fill: 0.04, ptSize: 2, colors: true, serif: false, angleFill: 0.22, bac: false },
  bac: { ink: "#1a1a1a", lw: 1.3, fill: 0, ptSize: 1.4, colors: false, serif: true, angleFill: 0, bac: true },
};
const col = (th: Theme, c: string | undefined, fallback: string) => (th.colors ? c ?? fallback : th.ink);
const labelStyle = (th: Theme, color: string) =>
  th.serif
    ? { autoPosition: true, fontSize: 16, strokeColor: color, cssStyle: "font-family:Georgia,'Times New Roman',serif;font-style:italic;" }
    : { offset: [7, 7], fontSize: 16, strokeColor: color, anchorX: "left" as const };
const lineOpts = (th: Theme, color: string) => ({ strokeColor: color, strokeWidth: th.lw, highlight: false, fixed: true });
const ptStyle = (th: Theme, color: string, label?: string) => ({
  fixed: true, showInfobox: false, size: th.ptSize, fillColor: color, strokeColor: color,
  name: label ?? "", withLabel: !!label, label: labelStyle(th, color),
});
const hidden = { visible: false, withLabel: false };

/** Construiește geometria din spec folosind tipuri NATIVE JSXGraph (calcul exact), cu tema `th`. */
function buildFromSpec(JXG: any, board: any, spec: FigureSpec2D, solved: Record<string, SolvedPoint>, th: Theme) {
  const pts: AnyMap = {};
  const els: AnyMap = {};
  for (const [id, p] of Object.entries(solved)) {
    pts[id] = board.create("point", [p.x, p.y], ptStyle(th, th.ink, p.label ?? id));
  }
  const resolveLine = (ref: LineRef): any =>
    typeof ref === "string" ? els[ref] : board.create("line", [pts[ref[0]], pts[ref[1]]], hidden);
  const firstTriangle = (): [string, string, string] => {
    const poly = spec.elements.find((e) => e.kind === "polygon") as any;
    const ids = poly?.points ?? Object.keys(solved);
    return [ids[0], ids[1], ids[2]];
  };
  const opposite = (of: string[], from: string): [string, string] => {
    const o = of.filter((id) => id !== from);
    return [o[0], o[1]];
  };
  const labeledPoint = (obj: any, color: string, label?: string) => {
    obj.setAttribute({ visible: true, size: th.ptSize, fillColor: color, strokeColor: color, name: label ?? "", withLabel: !!label, label: labelStyle(th, color) });
    return obj;
  };
  const centerStyle = (color: string, name?: string) => ({ ...ptStyle(th, color, name), visible: true });
  // Punct cu coordonate-funcție (pt. semnele mici, calculate de motor).
  const fpt = (fn: () => number[]) => board.create("point", [() => fn()[0], () => fn()[1]], hidden);

  for (const e of spec.elements) {
    switch (e.kind) {
      case "triangleFromSides":
      case "quadFromConstraints":
        break;
      case "polygon": {
        const fill = th.bac ? 0 : e.shade ? (e.fillOpacity ?? 0.18) : (e.fillOpacity ?? th.fill);
        board.create("polygon", e.points.map((id) => pts[id]), {
          borders: { strokeColor: col(th, e.color, th.ink), strokeWidth: th.lw, highlight: false },
          fillColor: col(th, e.color, "#3b82f6"), fillOpacity: fill,
          vertices: { visible: false }, hasInnerPoints: false, highlight: false,
        });
        break;
      }
      case "circumcircle":
        board.create("circumcircle", e.of.map((id) => pts[id]), {
          strokeColor: col(th, e.color, "#2563eb"), strokeWidth: th.lw, fillOpacity: 0, highlight: false,
          center: centerStyle(col(th, e.color, "#2563eb"), e.centerLabel ?? "O"),
        });
        break;
      case "incircle":
        board.create("incircle", e.of.map((id) => pts[id]), {
          strokeColor: col(th, e.color, "#dc2626"), strokeWidth: th.lw, fillOpacity: 0, highlight: false,
          center: centerStyle(col(th, e.color, "#dc2626"), e.centerLabel ?? "I"),
        });
        break;
      case "point": {
        if (e.from === "intersection") {
          const p = labeledPoint(board.create("intersection", [resolveLine(e.of[0]), resolveLine(e.of[1]), e.index ?? 0], hidden), col(th, e.color, th.ink), e.label ?? "");
          if (e.id) pts[e.id] = p; else if (e.label) pts[e.label] = p;
          break;
        }
        const tri = (e.of ?? firstTriangle()).map((id) => pts[id]);
        let p: any;
        if (e.from === "incenter" || e.from === "circumcenter") {
          p = board.create(e.from, tri, centerStyle(col(th, e.color, th.ink), e.label ?? ""));
        } else if (e.from === "centroid") {
          const [A, B, C] = tri;
          p = board.create("point", [() => (A.X() + B.X() + C.X()) / 3, () => (A.Y() + B.Y() + C.Y()) / 3], { ...centerStyle(col(th, e.color, th.ink), e.label ?? ""), fixed: true });
        } else {
          const [A, B, C] = tri;
          const altA = board.create("perpendicular", [board.create("line", [B, C], hidden), A], hidden);
          const altB = board.create("perpendicular", [board.create("line", [A, C], hidden), B], hidden);
          p = labeledPoint(board.create("intersection", [altA, altB, 0], hidden), col(th, e.color, th.ink), e.label ?? "");
        }
        if (e.id) pts[e.id] = p;
        break;
      }
      case "median": {
        const [o1, o2] = opposite(e.of, e.from);
        const mid = board.create("midpoint", [pts[o1], pts[o2]], hidden);
        const seg = board.create("segment", [pts[e.from], mid], lineOpts(th, col(th, e.color, "#16a34a")));
        if (e.id) els[e.id] = seg;
        break;
      }
      case "bisector": {
        const [o1, o2] = opposite(e.of, e.from);
        const bl = board.create("bisector", [pts[o1], pts[e.from], pts[o2]], hidden);
        const foot = board.create("intersection", [bl, board.create("line", [pts[o1], pts[o2]], hidden), 0], hidden);
        board.create("segment", [pts[e.from], foot], lineOpts(th, col(th, e.color, "#9333ea")));
        if (e.id) els[e.id] = bl;
        break;
      }
      case "altitude": {
        const [o1, o2] = opposite(e.of, e.from);
        const opp = board.create("line", [pts[o1], pts[o2]], hidden);
        const foot = board.create("perpendicularpoint", [opp, pts[e.from]], hidden);
        const seg = board.create("segment", [pts[e.from], foot], lineOpts(th, col(th, e.color, "#ea580c")));
        if (e.id) els[e.id] = seg;
        if (e.markRightAngle) board.create("angle", [pts[o1], foot, pts[e.from]], {
          radius: 0.45, type: "square", fillColor: th.ink, strokeColor: th.ink, fillOpacity: th.bac ? 0 : 0.3, withLabel: false, highlight: false,
        });
        break;
      }
      case "perpBisector": {
        const [o1, o2] = opposite(e.of, e.from);
        const opp = board.create("line", [pts[o1], pts[o2]], hidden);
        const mid = board.create("midpoint", [pts[o1], pts[o2]], hidden);
        const pb = board.create("perpendicular", [opp, mid], lineOpts(th, col(th, e.color, "#0d9488")));
        if (e.id) els[e.id] = pb;
        break;
      }
      case "angle": {
        const c = col(th, e.color, "#d97706");
        board.create("angle", [pts[e.from[0]], pts[e.at], pts[e.from[1]]], {
          radius: 0.7, name: e.label ?? "", withLabel: !!e.label, type: "sector",
          fillColor: c, strokeColor: c, fillOpacity: th.angleFill, strokeWidth: th.lw, highlight: false,
          label: { fontSize: 14, strokeColor: c },
        });
        break;
      }
      case "circle": {
        const c = col(th, e.color, "#2563eb");
        const arg = e.through ? [pts[e.center], pts[e.through]] : [pts[e.center], e.radius ?? 1];
        const circ = board.create("circle", arg, {
          strokeColor: c, strokeWidth: th.lw, fillOpacity: 0, highlight: false,
          center: e.centerLabel ? centerStyle(c, e.centerLabel) : { visible: false },
        });
        if (e.id) els[e.id] = circ;
        break;
      }
      case "tangentLines": {
        const c = els[e.to];
        const P = pts[e.from];
        if (!c) break;
        const color = col(th, e.color, "#9333ea");
        const polar = board.create("polarline", [c, P], hidden);
        const T1 = board.create("intersection", [c, polar, 0], hidden);
        const T2 = board.create("intersection", [c, polar, 1], hidden);
        board.create("line", [P, T1], { ...lineOpts(th, color), straightFirst: false, straightLast: false });
        board.create("line", [P, T2], { ...lineOpts(th, color), straightFirst: false, straightLast: false });
        if (e.markPoints !== false) {
          labeledPoint(T1, color, e.pointLabels?.[0] ?? "");
          labeledPoint(T2, color, e.pointLabels?.[1] ?? "");
        }
        break;
      }
      case "midpoint": {
        const m = labeledPoint(board.create("midpoint", [pts[e.of[0]], pts[e.of[1]]], hidden), col(th, e.color, "#475569"), e.label ?? "");
        if (e.id) pts[e.id] = m;
        break;
      }
      case "perpendicular": {
        const ln = board.create("line", [pts[e.toSegment[0]], pts[e.toSegment[1]]], hidden);
        const pp = board.create("perpendicular", [ln, pts[e.through]], lineOpts(th, col(th, e.color, "#475569")));
        if (e.id) els[e.id] = pp;
        break;
      }
      case "parallel": {
        const ln = board.create("line", [pts[e.toSegment[0]], pts[e.toSegment[1]]], hidden);
        const pl = board.create("parallel", [ln, pts[e.through]], lineOpts(th, col(th, e.color, "#475569")));
        if (e.id) els[e.id] = pl;
        break;
      }
      case "parallelAtDistance": {
        const P1 = pts[e.parallelTo[0]], P2 = pts[e.parallelTo[1]], OF = pts[e.offsetFrom];
        const off = (): [number, number] => {
          const dx = P2.X() - P1.X(), dy = P2.Y() - P1.Y(), L = Math.hypot(dx, dy) || 1;
          const nx = -dy / L, ny = dx / L;
          const s = Math.sign((OF.X() - P1.X()) * nx + (OF.Y() - P1.Y()) * ny) || 1;
          return [P1.X() + e.distance * s * nx, P1.Y() + e.distance * s * ny];
        };
        const Q = board.create("point", [() => off()[0], () => off()[1]], hidden);
        const base = board.create("line", [P1, P2], hidden);
        const par = board.create("parallel", [base, Q], e.visible === false ? hidden : { ...lineOpts(th, col(th, e.color, "#0d9488")), dash: 2 });
        if (e.id) els[e.id] = par;
        break;
      }
      case "segment": {
        const A = pts[e.between[0]], B = pts[e.between[1]];
        const seg = board.create("segment", [A, B], {
          ...lineOpts(th, col(th, e.color, th.ink)),
          name: e.showLength ? () => `${Math.round(Math.hypot(B.X() - A.X(), B.Y() - A.Y()) * 100) / 100}` : (e.label ?? ""),
          withLabel: !!(e.label || e.showLength),
          label: { fontSize: 14, strokeColor: th.ink, offset: [0, 12] },
        });
        if (e.id) els[e.id] = seg;
        break;
      }
      case "equalMark": {
        const A = pts[e.on[0]], B = pts[e.on[1]];
        const n = e.count ?? 1, color = col(th, e.color, th.ink);
        for (let i = 0; i < n; i++) {
          const o = (i - (n - 1) / 2) * 0.05;
          const tip = (sgn: number) => () => {
            const dx = B.X() - A.X(), dy = B.Y() - A.Y(), L = Math.hypot(dx, dy) || 1;
            const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
            const mx = A.X() + dx * 0.5 + ux * o * L, my = A.Y() + dy * 0.5 + uy * o * L;
            return [mx + nx * sgn * 0.05 * L, my + ny * sgn * 0.05 * L];
          };
          board.create("segment", [fpt(tip(1)), fpt(tip(-1))], lineOpts(th, color));
        }
        break;
      }
      case "parallelMark": {
        const A = pts[e.on[0]], B = pts[e.on[1]];
        const n = e.count ?? 1, color = col(th, e.color, th.ink);
        for (let i = 0; i < n; i++) {
          const o = (i - (n - 1) / 2) * 0.05;
          const corner = (kind: "apex" | "top" | "bot") => () => {
            const dx = B.X() - A.X(), dy = B.Y() - A.Y(), L = Math.hypot(dx, dy) || 1;
            const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, h = 0.045 * L;
            const mx = A.X() + dx * 0.5 + ux * o * L, my = A.Y() + dy * 0.5 + uy * o * L;
            if (kind === "apex") return [mx + ux * h, my + uy * h];
            if (kind === "top") return [mx - ux * h + nx * h, my - uy * h + ny * h];
            return [mx - ux * h - nx * h, my - uy * h - ny * h];
          };
          const apex = fpt(corner("apex"));
          board.create("segment", [fpt(corner("top")), apex], lineOpts(th, color));
          board.create("segment", [apex, fpt(corner("bot"))], lineOpts(th, color));
        }
        break;
      }
    }
  }
}

function boxOf(pts: SolvedPoint[], override?: [number, number, number, number]): [number, number, number, number] {
  if (override) return override;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY, 1) / 2;
  const pad = half * 0.5 + Math.max(2, half * 0.35);
  return [cx - pad, cy + pad, cx + pad, cy - pad];
}

export interface FigureRendererProps {
  spec: FigureSpec2D;
  size?: number;
  style?: FigureStyle;
  className?: string;
}

/**
 * Randează o FigureSpec2D într-un board JSXGraph (SVG), client-side. `style="bac"` aplică tema „de BAC"
 * + încadrarea canonică (similaritate, geometria neatinsă). `style="geogebra"` = stilul original colorat.
 */
export default function FigureRenderer({ spec, size = 420, style = "bac", className }: FigureRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const th = THEMES[style];

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

        // Rezolvă + (pt. bac) încadrează canonic. Box din coordonatele finale.
        const base = solveBasePoints(spec);
        const solved = style === "bac" ? frameSolved(base, spec.framing) : base;
        const box = style === "bac" ? boxOf(Object.values(solved), spec.boundingBox) : autoBoundingBox(spec);

        board = JXG.JSXGraph.initBoard(containerRef.current, {
          boundingbox: box, keepaspectratio: true, axis: false, grid: false,
          showCopyright: false, showNavigation: false, renderer: "svg",
          pan: { enabled: false }, zoom: { enabled: false },
        });
        buildFromSpec(JXG, board, spec, solved, th);
        board.update();

        const el = containerRef.current.querySelector("svg");
        if (el) setSvg(el.outerHTML);
      } catch (err) {
        if (!cancelled) setError((err as Error)?.message ?? String(err));
      }
    })();

    return () => {
      cancelled = true;
      try { if (board && JXGref?.JSXGraph?.freeBoard) JXGref.JSXGraph.freeBoard(board); } catch { /* noop */ }
    };
  }, [spec, style, th]);

  function downloadSvg() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "figura.svg"; a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className={className}>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Eroare la randarea figurii: {error}</div>
      </div>
    );
  }

  const h = style === "bac" ? Math.round(size * 0.74) : size; // aspect peisaj pentru bac
  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: size, height: h, background: "transparent" }} className="rounded border border-gray-200" />
      <button type="button" onClick={downloadSvg} disabled={!svg} className="mt-2 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40">↓ Export SVG</button>
    </div>
  );
}
