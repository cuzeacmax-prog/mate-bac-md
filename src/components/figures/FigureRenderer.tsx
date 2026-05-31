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

/** Construiește geometria din spec folosind tipuri NATIVE JSXGraph (calcul exact). */
function buildFromSpec(JXG: any, board: any, spec: FigureSpec2D) {
  const pts: AnyMap = {};
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

  for (const e of spec.elements) {
    switch (e.kind) {
      case "polygon":
        board.create(
          "polygon",
          e.points.map((id) => pts[id]),
          {
            borders: { strokeColor: "#0f172a", strokeWidth: 2, highlight: false },
            fillColor: "#3b82f6",
            fillOpacity: 0.04,
            vertices: { visible: false },
            hasInnerPoints: false,
            highlight: false,
          },
        );
        break;
      case "circumcircle":
        board.create(
          "circumcircle",
          e.of.map((id) => pts[id]),
          {
            strokeColor: e.color ?? "#2563eb",
            strokeWidth: 2,
            fillOpacity: 0,
            highlight: false,
            center: centerStyle(e.color ?? "#2563eb", e.centerLabel ?? "O"),
          },
        );
        break;
      case "incircle":
        board.create(
          "incircle",
          e.of.map((id) => pts[id]),
          {
            strokeColor: e.color ?? "#dc2626",
            strokeWidth: 2,
            fillOpacity: 0,
            highlight: false,
            center: centerStyle(e.color ?? "#dc2626", e.centerLabel ?? "I"),
          },
        );
        break;
      case "point": {
        const tri = (e.of ?? firstTriangle()).map((id) => pts[id]);
        const type = e.from === "incenter" ? "incenter" : "circumcenter";
        board.create(type, tri, centerStyle("#0f172a", e.label ?? ""));
        break;
      }
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
