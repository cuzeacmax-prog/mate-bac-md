import FigureRenderer from "@/components/figures/FigureRenderer";
import type { FigureSpec2D } from "@/lib/figures/spec";

export const metadata = { title: "Figuri — probă" };

/** (1) Triunghi isoscel ABC (26,26,20) + MN∥AC la distanță 18 + trapez AMNC umbrit. */
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
  ],
};

/** (2) Paralelogram ABCD (∠A=60°, AB:AD=1:2, BD=3) + diagonala BD + bisectoarea din A + K. */
const FIG_PARA: FigureSpec2D = {
  points: [],
  elements: [
    { kind: "quadFromConstraints", ids: ["A", "B", "C", "D"], angleAt: "A", angle: 60, sideRatio: [1, 2], scaleBy: { diagonal: "BD", length: 3 } },
    { kind: "polygon", points: ["A", "B", "C", "D"] },
    { kind: "segment", between: ["B", "D"], id: "BD", label: "BD = 3", color: "#2563eb" },
    { kind: "bisector", of: ["A", "B", "D"], from: "A", id: "bisA", color: "#9333ea" },
    { kind: "point", from: "intersection", of: ["bisA", "BD"], id: "K", label: "K", color: "#dc2626" },
    { kind: "angle", at: "A", from: ["B", "D"], label: "60°", color: "#d97706" },
  ],
};

/** Triunghi cu 4 puncte remarcabile + cerc înscris + circumscris (ETAPA 20). */
const FIG_REMARKABLE: FigureSpec2D = {
  points: [{ id: "A", x: -3, y: -1 }, { id: "B", x: 4, y: -1 }, { id: "C", x: 0, y: 4 }],
  elements: [
    { kind: "polygon", points: ["A", "B", "C"] },
    { kind: "circumcircle", of: ["A", "B", "C"], centerLabel: "O", color: "#2563eb" },
    { kind: "incircle", of: ["A", "B", "C"], centerLabel: "I", color: "#dc2626" },
    { kind: "point", from: "centroid", of: ["A", "B", "C"], label: "G", color: "#16a34a" },
    { kind: "point", from: "orthocenter", of: ["A", "B", "C"], label: "H", color: "#ea580c" },
  ],
};

/** Cerc cu 2 tangente dintr-un punct exterior (ETAPA 20). */
const FIG_TANGENTS: FigureSpec2D = {
  points: [{ id: "O", x: 0, y: 0 }, { id: "P", x: 5, y: 1.5 }],
  elements: [
    { kind: "circle", id: "c", center: "O", radius: 2.2, centerLabel: "O", color: "#2563eb" },
    { kind: "tangentLines", from: "P", to: "c", pointLabels: ["T_1", "T_2"], color: "#9333ea" },
    { kind: "segment", between: ["O", "P"], color: "#94a3b8" },
  ],
  boundingBox: [-3.5, 4.5, 7.5, -4.5],
};

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <ul className="mt-2 space-y-1 text-sm text-gray-700">
      {items.map(([color, text]) => (
        <li key={text}>
          <span className="inline-block h-2 w-4 align-middle" style={{ background: color }} /> {text}
        </li>
      ))}
    </ul>
  );
}

function FigureCard({ title, spec, legend, size = 380 }: { title: string; spec: FigureSpec2D; legend: Array<[string, string]>; size?: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="font-medium text-gray-900">{title}</h2>
      <div className="mt-3 flex flex-wrap items-start gap-6">
        <FigureRenderer spec={spec} size={size} />
        <div className="min-w-[240px]">
          <Legend items={legend} />
          <pre className="mt-3 max-w-md overflow-auto rounded bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">
{JSON.stringify(spec, null, 1)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function FiguriPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Figuri prin CONSTRÂNGERI</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Exercițiile reale dau <strong>constrângeri</strong> (laturi, unghiuri, rapoarte, distanțe), nu
        coordonate. Motorul rezolvă figura din date — SSS, paralelogram, intersecții, paralele la
        distanță — corect prin construcție. Observă: în JSON, <code>points: []</code>.
      </p>

      <div className="mt-6 space-y-6">
        <FigureCard
          title="(1) Triunghi isoscel din laturi (26,26,20) + MN∥AC la dist. 18 + trapez AMNC"
          spec={FIG_TRAPEZ}
          size={420}
          legend={[
            ["#0f172a", "triunghi rezolvat din laturi (SSS)"],
            ["#9333ea", "M, N = MN∥AC ∩ laturi (calculate)"],
            ["#16a34a", "trapez AMNC (umbrit)"],
            ["#475569", "lungimile laturilor"],
          ]}
        />
        <FigureCard
          title="(2) Paralelogram din ∠A=60°, AB:AD=1:2, BD=3 + bisectoarea din A → K"
          spec={FIG_PARA}
          size={420}
          legend={[
            ["#0f172a", "paralelogram rezolvat din constrângeri"],
            ["#2563eb", "diagonala BD = 3"],
            ["#9333ea", "bisectoarea din A"],
            ["#dc2626", "K = bisectoare ∩ BD"],
            ["#d97706", "unghiul ∠A = 60°"],
          ]}
        />

        <h2 className="pt-2 text-sm font-semibold text-gray-500">Vocabular de relații (ETAPA 20)</h2>
        <FigureCard
          title="Triunghi cu 4 puncte remarcabile + cerc înscris + circumscris"
          spec={FIG_REMARKABLE}
          legend={[
            ["#2563eb", "circumscris O"], ["#dc2626", "înscris I"],
            ["#16a34a", "G centroid"], ["#ea580c", "H ortocentru"],
          ]}
        />
        <FigureCard
          title="Cerc cu 2 tangente dintr-un punct exterior"
          spec={FIG_TANGENTS}
          legend={[["#2563eb", "cerc O"], ["#9333ea", "tangentele din P + T₁,T₂"]]}
        />
      </div>
    </div>
  );
}
