"use client";

import { useMemo, useRef, useState } from "react";
import { projectFigure, type Drawing2D } from "@/lib/figures/project";
import { verifyFigure3D } from "@/lib/figures/verify";
import type { FigureSpec3D } from "@/lib/figures/spec3d";

const INK = "#1a1a1a";

export interface Figure3DRendererProps { spec: FigureSpec3D; size?: number; className?: string }

/**
 * Randează o FigureSpec3D ca DESEN 2D STATIC CURAT (stil BAC): proiecție ortografică a coordonatelor 3D,
 * muchii vizibile pline / ascunse punctate, vârfuri etichetate, FĂRĂ axe, FĂRĂ slidere de debug WebGL.
 * Rotația se face din barele az/el → re-proiectează + redesenează SVG (nu view3d/WebGL).
 */
export default function Figure3DRenderer({ spec, size = 460, className }: Figure3DRendererProps) {
  const [az, setAz] = useState(-35); // oblic
  const [el, setEl] = useState(20);  // ușor de sus
  const svgRef = useRef<SVGSVGElement>(null);

  const { drawing, error } = useMemo<{ drawing: Drawing2D | null; error: string | null }>(() => {
    try {
      const ver = verifyFigure3D(spec);
      if (!ver.ok) return { drawing: null, error: `invariante picate: ${ver.checks.filter((c) => !c.pass).map((c) => `${c.name} (${c.detail})`).join(" · ")}` };
      return { drawing: projectFigure(spec, az, el), error: null };
    } catch (e) { return { drawing: null, error: (e as Error)?.message ?? String(e) }; }
  }, [spec, az, el]);

  function downloadSvg() {
    if (!svgRef.current) return;
    const blob = new Blob([svgRef.current.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "figura3d.svg"; a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return <div className={className}><div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Eroare la figura 3D: {error}</div></div>;
  }
  if (!drawing) return null;

  const { minX, minY, maxX, maxY } = drawing.bbox;
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const span = Math.max(w, h);
  const pad = span * 0.14;
  const vb = `${minX - pad} ${minY - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const fs = span * 0.052;

  return (
    <div className={className}>
      <svg ref={svgRef} width={size} height={size} viewBox={vb} preserveAspectRatio="xMidYMid meet"
        style={{ background: "transparent" }} className="rounded border border-gray-200">
        {drawing.polylines.map((pl, i) => (
          <polyline key={i} points={pl.pts.map((p) => `${p[0]},${p[1]}`).join(" ")}
            fill="none" stroke={INK} strokeWidth={1.4} vectorEffect="non-scaling-stroke"
            strokeDasharray={pl.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {drawing.labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} fontSize={fs} fill={INK} textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}>{l.text}</text>
        ))}
      </svg>

      <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500" style={{ width: size }}>
        <label className="flex items-center gap-2">azimut
          <input type="range" min={-180} max={180} value={az} onChange={(e) => setAz(+e.target.value)} className="flex-1" />
          <span className="w-10 text-right tabular-nums">{az}°</span>
        </label>
        <label className="flex items-center gap-2">elevație
          <input type="range" min={-80} max={80} value={el} onChange={(e) => setEl(+e.target.value)} className="flex-1" />
          <span className="w-10 text-right tabular-nums">{el}°</span>
        </label>
        <button type="button" onClick={downloadSvg} className="self-start text-gray-500 hover:text-gray-900">↓ Export SVG</button>
      </div>
    </div>
  );
}
