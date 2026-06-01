import FigureRenderer from "@/components/figures/FigureRenderer";
import type { FigureSpec2D } from "@/lib/figures/spec";

export const metadata = { title: "Figuri — îmbogățire 2D" };

/** (a) Patrulater cu diagonale + cevianǎ → toate intersecțiile marcate (detect) + P etichetat. */
const FIG_INTERSECT: FigureSpec2D = {
  points: [
    { id: "A", x: 0, y: 0 }, { id: "B", x: 6, y: 0 }, { id: "C", x: 7, y: 5 }, { id: "D", x: 1, y: 4 },
  ],
  intersections: "detect",
  elements: [
    { kind: "polygon", points: ["A", "B", "C", "D"] },
    { kind: "segment", between: ["A", "C"], id: "ac" },
    { kind: "segment", between: ["B", "D"], id: "bd" },
    { kind: "pointOnSegment", on: ["C", "D"], ratio: 0.5, id: "E", label: "E" },
    { kind: "segment", between: ["A", "E"], id: "ae" },
    { kind: "point", from: "intersection", of: ["ac", "bd"], id: "P", label: "P", color: "#dc2626" },
  ],
};

/** (b) Triunghi: ∠A măsurat de motor + 2 mediane care se intersectează în X, cu unghiul la X măsurat. */
const FIG_ANGLES: FigureSpec2D = {
  points: [
    { id: "A", x: 0, y: 0 }, { id: "B", x: 7, y: 0 }, { id: "C", x: 2, y: 5 },
  ],
  elements: [
    { kind: "polygon", points: ["A", "B", "C"] },
    { kind: "angle", at: "A", from: ["B", "C"], value: true, color: "#d97706" },
    { kind: "pointOnSegment", on: ["A", "C"], ratio: 0.5, id: "E", label: "E" },
    { kind: "pointOnSegment", on: ["A", "B"], ratio: 0.5, id: "F", label: "F" },
    { kind: "segment", between: ["B", "E"], id: "be" },
    { kind: "segment", between: ["C", "F"], id: "cf" },
    { kind: "point", from: "intersection", of: ["be", "cf"], id: "X", label: "X", color: "#dc2626" },
    { kind: "angle", at: "X", from: ["B", "C"], value: true, color: "#2563eb" },
  ],
};

/** (c) Trapez HAȘURAT (problemă de arie) + semne de paralelism + dimensiuni. */
const FIG_HATCH: FigureSpec2D = {
  points: [
    { id: "A", x: 0, y: 0 }, { id: "B", x: 8, y: 0 }, { id: "C", x: 6, y: 4 }, { id: "D", x: 2, y: 4 },
  ],
  elements: [
    { kind: "polygon", points: ["A", "B", "C", "D"], hatch: true },
    { kind: "parallelMark", on: ["A", "B"], count: 1 },
    { kind: "parallelMark", on: ["D", "C"], count: 1 },
    { kind: "segment", between: ["A", "B"], label: "8" },
    { kind: "segment", between: ["D", "C"], label: "4" },
    { kind: "altitude", of: ["D", "A", "B"], from: "D", markRightAngle: true, color: "#1a1a1a" },
  ],
};

function FigureCard({ title, spec, note }: { title: string; spec: FigureSpec2D; note: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="font-medium text-gray-900">{title}</h2>
      <p className="mt-0.5 text-xs text-gray-500">{note}</p>
      <div className="mt-3 flex flex-wrap items-start gap-8">
        <FigureRenderer spec={spec} style="bac" size={420} />
        <pre className="max-w-md overflow-auto rounded bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">
{JSON.stringify(spec, null, 1)}
        </pre>
      </div>
    </div>
  );
}

export default function FiguriPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Figuri 2D — îmbogățire (ETAPA 24)</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Auto-intersecții (calculate de motor, filtrate pe segment), unghiuri măsurate, puncte pe segment,
        marcaje reutilizabile și hașură. Totul validat înainte de randare (id-uri, constrângeri). Stil BAC.
      </p>

      <div className="mt-6 space-y-6">
        <FigureCard
          title="(a) Diagonale + cevianǎ → auto-intersecții"
          note="intersections:'detect' marchează AE∩BD; P = AC∩BD etichetat explicit. Toate calculate, niciuna plasată."
          spec={FIG_INTERSECT}
        />
        <FigureCard
          title="(b) Unghi măsurat de motor + unghi la o intersecție"
          note="∠A cu value:true (grade reale); medianele BE, CF se taie în X; ∠ la X măsurat. pointOnSegment pt. E, F."
          spec={FIG_ANGLES}
        />
        <FigureCard
          title="(c) Regiune hașurată (problemă de arie)"
          note="polygon hatch:true (linii diagonale clipate), semne de paralelism pe AB‖DC, înălțime cu unghi drept."
          spec={FIG_HATCH}
        />
      </div>
    </div>
  );
}
