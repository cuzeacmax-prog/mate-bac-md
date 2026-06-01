import FigureRenderer from "@/components/figures/FigureRenderer";
import type { FigureSpec2D } from "@/lib/figures/spec";

export const metadata = { title: "Figuri — BAC vs GeoGebra" };

/** (1) Triunghi isoscel ABC (26,26,20) + MN∥AC la dist. 18 + trapez AMNC + semne BAC. */
const FIG_TRAPEZ: FigureSpec2D = {
  points: [],
  elements: [
    { kind: "triangleFromSides", ids: ["A", "B", "C"], sides: { AB: 26, BC: 26, CA: 20 } },
    { kind: "polygon", points: ["A", "B", "C"] },
    { kind: "parallelAtDistance", id: "MN", parallelTo: ["A", "C"], offsetFrom: "B", distance: 18, visible: false },
    { kind: "point", from: "intersection", of: ["MN", ["A", "B"]], id: "M", label: "M", color: "#9333ea" },
    { kind: "point", from: "intersection", of: ["MN", ["B", "C"]], id: "N", label: "N", color: "#9333ea" },
    { kind: "polygon", points: ["A", "M", "N", "C"], shade: true, color: "#16a34a" },
    { kind: "segment", between: ["A", "B"], label: "26", color: "#475569" },
    { kind: "segment", between: ["B", "C"], label: "26", color: "#475569" },
    { kind: "segment", between: ["A", "C"], label: "20", color: "#475569" },
    { kind: "equalMark", on: ["A", "B"], count: 1 },
    { kind: "equalMark", on: ["B", "C"], count: 1 },
    { kind: "parallelMark", on: ["A", "C"], count: 1 },
    { kind: "parallelMark", on: ["M", "N"], count: 1 },
  ],
};

/** (2) Paralelogram ABCD (∠A=60°, AB:AD=1:2, BD=3) + bisectoarea din A → K. AB ca bază. */
const FIG_PARA: FigureSpec2D = {
  points: [],
  framing: { baseEdge: ["A", "B"] },
  elements: [
    { kind: "quadFromConstraints", ids: ["A", "B", "C", "D"], angleAt: "A", angle: 60, sideRatio: [1, 2], scaleBy: { diagonal: "BD", length: 3 } },
    { kind: "polygon", points: ["A", "B", "C", "D"] },
    { kind: "segment", between: ["B", "D"], id: "BD", label: "BD = 3", color: "#2563eb" },
    { kind: "bisector", of: ["A", "B", "D"], from: "A", id: "bisA", color: "#9333ea" },
    { kind: "point", from: "intersection", of: ["bisA", "BD"], id: "K", label: "K", color: "#dc2626" },
    { kind: "angle", at: "A", from: ["B", "D"], label: "60°", color: "#d97706" },
  ],
};

function CompareRow({ title, spec, note }: { title: string; spec: FigureSpec2D; note: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="font-medium text-gray-900">{title}</h2>
      <p className="mt-0.5 text-xs text-gray-500">{note}</p>
      <div className="mt-3 flex flex-wrap items-start gap-8">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">GeoGebra (vechi)</div>
          <FigureRenderer spec={spec} style="geogebra" size={360} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-700">BAC (nou)</div>
          <FigureRenderer spec={spec} style="bac" size={380} />
        </div>
        <pre className="max-w-sm overflow-auto rounded bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">
{JSON.stringify(spec, null, 1)}
        </pre>
      </div>
    </div>
  );
}

export default function FiguriPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Figuri: temă „BAC” + încadrare canonică</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Aceeași spec, două prezentări. <strong>GeoGebra</strong> = stilul colorat original;{" "}
        <strong>BAC</strong> = linii negre uniforme, fără umbriri, etichete serif italic, bază orizontală,
        A în stânga-jos. Geometria (unghiuri, rapoarte) e <em>identică</em> — diferă doar similaritatea de
        încadrare și stilul.
      </p>

      <div className="mt-6 space-y-6">
        <CompareRow
          title="(1) Triunghi isoscel + MN∥AC + trapez AMNC"
          note="BAC: bază AB orizontală, fără umbrire, semne de egalitate (laturi 26) și paralelism (AC, MN)."
          spec={FIG_TRAPEZ}
        />
        <CompareRow
          title="(2) Paralelogram din constrângeri + bisectoarea din A → K"
          note="BAC: framing override baseEdge=[A,B] (convenția pune AB ca bază, deși AD e mai lung)."
          spec={FIG_PARA}
        />
      </div>
    </div>
  );
}
