"use client";

import { useEffect, useRef, useState } from "react";
import { autoBoundingBox, type FigureElement, type FigureSpec2D } from "@/lib/figures/spec";

/* eslint-disable @typescript-eslint/no-explicit-any -- punte către JSXGraph (lib fără tipuri ESM stricte) */

type AnyMap = Record<string, any>;

/** Stiluri „de manual": linii sobre, două culori distincte pentru cercuri. */
const POINT_STYLE = {
  fixed: true,
  showInfobox: false,
  size: 2,
  fillColor: "#0f172a",
  strokeColor: "#0f172a",
  label: { offset: [7, 7], fontSize: 16, strokeColor: "#0f172a", anchorX: "left" as const },
};
const centerStyle = (color: string, name?: string) => ({
  visible: true,
  name: name ?? "",
  size: 2,
  fillColor: color,
  strokeColor: color,
  withLabel: !!name,
  label: { offset: [7, -4], fontSize: 16, strokeColor: color, anchorX: "left" as const },
});

// Paletă „de manual" pentru relațiile noi.
const COL = {
  ink: "#0f172a", median: "#16a34a", bisector: "#9333ea", altitude: "#ea580c",
  perpbis: "#0d9488", angle: "#d97706", tangent: "#2563eb", aux: "#475569",
};
const lineOpts = (color: string) => ({ strokeColor: color, strokeWidth: 2, highlight: false, fixed: true });
const hidden = { visible: false, withLabel: false };

/** Construiește geometria din spec folosind tipuri NATIVE JSXGraph (calcul exact). */
function buildFromSpec(JXG: any, board: any, spec: FigureSpec2D) {
  const pts: AnyMap = {};
  const els: AnyMap = {}; // elemente cu id (ex. cercuri), pentru referire
  for (const p of spec.points) {
    pts[p.id] = board.create("point", [p.x, p.y], { ...POINT_STYLE, name: p.label ?? p.id });
  }
  const firstTriangle = (): [string, string, string] => {
    const poly = spec.elements.find((e) => e.kind === "polygon") as
      | Extract<FigureElement, { kind: "polygon" }>
      | undefined;
    const ids = poly?.points ?? spec.points.map((p) => p.id);
    return [ids[0], ids[1], ids[2]];
  };
  const opposite = (of: string[], from: string): [string, string] => {
    const o = of.filter((id) => id !== from);
    return [o[0], o[1]];
  };
  const labeledPoint = (obj: any, color: string, label?: string) => {
    obj.setAttribute({ visible: true, size: 2, fillColor: color, strokeColor: color, name: label ?? "", withLabel: !!label,
      label: { offset: [7, -4], fontSize: 15, strokeColor: color, anchorX: "left" } });
    return obj;
  };

  for (const e of spec.elements) {
    switch (e.kind) {
      case "polygon":
        board.create("polygon", e.points.map((id) => pts[id]), {
          borders: { strokeColor: COL.ink, strokeWidth: 2, highlight: false },
          fillColor: "#3b82f6", fillOpacity: 0.04, vertices: { visible: false }, hasInnerPoints: false, highlight: false,
        });
        break;
      case "circumcircle":
        board.create("circumcircle", e.of.map((id) => pts[id]), {
          strokeColor: e.color ?? "#2563eb", strokeWidth: 2, fillOpacity: 0, highlight: false,
          center: centerStyle(e.color ?? "#2563eb", e.centerLabel ?? "O"),
        });
        break;
      case "incircle":
        board.create("incircle", e.of.map((id) => pts[id]), {
          strokeColor: e.color ?? "#dc2626", strokeWidth: 2, fillOpacity: 0, highlight: false,
          center: centerStyle(e.color ?? "#dc2626", e.centerLabel ?? "I"),
        });
        break;
      case "point": {
        const tri = (e.of ?? firstTriangle()).map((id) => pts[id]);
        if (e.from === "incenter" || e.from === "circumcenter") {
          board.create(e.from, tri, centerStyle(e.color ?? COL.ink, e.label ?? ""));
        } else if (e.from === "centroid") {
          const [A, B, C] = tri;
          board.create("point", [() => (A.X() + B.X() + C.X()) / 3, () => (A.Y() + B.Y() + C.Y()) / 3],
            { ...centerStyle(e.color ?? COL.ink, e.label ?? ""), fixed: true });
        } else { // orthocenter = intersecția a două înălțimi
          const [A, B, C] = tri;
          const altA = board.create("perpendicular", [board.create("line", [B, C], hidden), A], hidden);
          const altB = board.create("perpendicular", [board.create("line", [A, C], hidden), B], hidden);
          labeledPoint(board.create("intersection", [altA, altB, 0], hidden), e.color ?? COL.ink, e.label ?? "");
        }
        break;
      }
      case "median": {
        const [o1, o2] = opposite(e.of, e.from);
        const mid = board.create("midpoint", [pts[o1], pts[o2]], hidden);
        board.create("segment", [pts[e.from], mid], lineOpts(e.color ?? COL.median));
        break;
      }
      case "bisector": {
        const [o1, o2] = opposite(e.of, e.from);
        const bl = board.create("bisector", [pts[o1], pts[e.from], pts[o2]], hidden);
        const foot = board.create("intersection", [bl, board.create("line", [pts[o1], pts[o2]], hidden), 0], hidden);
        board.create("segment", [pts[e.from], foot], lineOpts(e.color ?? COL.bisector));
        break;
      }
      case "altitude": {
        const [o1, o2] = opposite(e.of, e.from);
        const opp = board.create("line", [pts[o1], pts[o2]], hidden);
        const foot = board.create("perpendicularpoint", [opp, pts[e.from]], hidden);
        board.create("segment", [pts[e.from], foot], lineOpts(e.color ?? COL.altitude));
        if (e.markRightAngle) board.create("angle", [pts[o1], foot, pts[e.from]],
          { radius: 0.45, type: "square", fillColor: e.color ?? COL.altitude, strokeColor: e.color ?? COL.altitude, fillOpacity: 0.3, withLabel: false, highlight: false });
        break;
      }
      case "perpBisector": {
        const [o1, o2] = opposite(e.of, e.from);
        const opp = board.create("line", [pts[o1], pts[o2]], hidden);
        const mid = board.create("midpoint", [pts[o1], pts[o2]], hidden);
        board.create("perpendicular", [opp, mid], lineOpts(e.color ?? COL.perpbis));
        break;
      }
      case "angle":
        board.create("angle", [pts[e.from[0]], pts[e.at], pts[e.from[1]]], {
          radius: 0.7, name: e.label ?? "", withLabel: !!e.label, type: "sector",
          fillColor: e.color ?? COL.angle, strokeColor: e.color ?? COL.angle, fillOpacity: 0.25, highlight: false,
          label: { fontSize: 15, strokeColor: e.color ?? COL.angle },
        });
        break;
      case "circle": {
        const arg = e.through ? [pts[e.center], pts[e.through]] : [pts[e.center], e.radius ?? 1];
        const c = board.create("circle", arg, {
          strokeColor: e.color ?? COL.tangent, strokeWidth: 2, fillOpacity: 0, highlight: false,
          center: e.centerLabel ? centerStyle(e.color ?? COL.tangent, e.centerLabel) : { visible: false },
        });
        if (e.id) els[e.id] = c;
        break;
      }
      case "tangentLines": {
        const c = els[e.to];
        const P = pts[e.from];
        if (!c) break;
        const polar = board.create("polarline", [c, P], hidden);
        const T1 = board.create("intersection", [c, polar, 0], hidden);
        const T2 = board.create("intersection", [c, polar, 1], hidden);
        board.create("line", [P, T1], { ...lineOpts(e.color ?? COL.tangent), straightFirst: false, straightLast: false });
        board.create("line", [P, T2], { ...lineOpts(e.color ?? COL.tangent), straightFirst: false, straightLast: false });
        if (e.markPoints !== false) {
          labeledPoint(T1, e.color ?? COL.tangent, e.pointLabels?.[0] ?? "");
          labeledPoint(T2, e.color ?? COL.tangent, e.pointLabels?.[1] ?? "");
        }
        break;
      }
      case "midpoint":
        labeledPoint(board.create("midpoint", [pts[e.of[0]], pts[e.of[1]]], hidden), e.color ?? COL.aux, e.label ?? "");
        break;
      case "perpendicular": {
        const ln = board.create("line", [pts[e.toSegment[0]], pts[e.toSegment[1]]], hidden);
        board.create("perpendicular", [ln, pts[e.through]], lineOpts(e.color ?? COL.aux));
        break;
      }
      case "parallel": {
        const ln = board.create("line", [pts[e.toSegment[0]], pts[e.toSegment[1]]], hidden);
        board.create("parallel", [ln, pts[e.through]], lineOpts(e.color ?? COL.aux));
        break;
      }
      case "segment":
        board.create("segment", [pts[e.between[0]], pts[e.between[1]]], {
          ...lineOpts(e.color ?? COL.ink), name: e.label ?? "", withLabel: !!e.label,
          label: { fontSize: 15, strokeColor: e.color ?? COL.ink, offset: [0, 10] },
        });
        break;
    }
  }
}

export interface FigureRendererProps {
  spec: FigureSpec2D;
  size?: number;
  className?: string;
}

/**
 * Randează o FigureSpec2D într-un board JSXGraph (renderer SVG), client-side.
 * Geometria e exactă (motorul calculează tangența/centrele). Permite export SVG static.
 */
export default function FigureRenderer({ spec, size = 480, className }: FigureRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

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

        board = JXG.JSXGraph.initBoard(containerRef.current, {
          boundingbox: autoBoundingBox(spec),
          keepaspectratio: true,
          axis: false,
          grid: false,
          showCopyright: false,
          showNavigation: false,
          renderer: "svg",
          pan: { enabled: false },
          zoom: { enabled: false },
        });

        buildFromSpec(JXG, board, spec);
        board.update();

        const el = containerRef.current.querySelector("svg");
        if (el) setSvg(el.outerHTML);
      } catch (err) {
        if (!cancelled) setError((err as Error)?.message ?? String(err));
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (board && JXGref?.JSXGraph?.freeBoard) JXGref.JSXGraph.freeBoard(board);
      } catch {
        /* noop */
      }
    };
  }, [spec]);

  function downloadSvg() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "figura.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className={className}>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Eroare la randarea figurii: {error}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        style={{ width: size, height: size }}
        className="rounded border border-gray-200 bg-white"
      />
      <button
        type="button"
        onClick={downloadSvg}
        disabled={!svg}
        className="mt-2 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40"
      >
        ↓ Export SVG
      </button>
    </div>
  );
}
