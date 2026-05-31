import FigureRenderer from "@/components/figures/FigureRenderer";
import type { FigureSpec2D } from "@/lib/figures/spec";

export const metadata = { title: "Figuri — probă" };

/** a) Triunghi cu cele 4 puncte remarcabile (O, I, G, H) + cerc înscris + circumscris. */
const FIG_REMARKABLE: FigureSpec2D = {
  points: [
    { id: "A", x: -3, y: -1 },
    { id: "B", x: 4, y: -1 },
    { id: "C", x: 0, y: 4 },
  ],
  elements: [
    { kind: "polygon", points: ["A", "B", "C"] },
    { kind: "circumcircle", of: ["A", "B", "C"], centerLabel: "O", color: "#2563eb" },
    { kind: "incircle", of: ["A", "B", "C"], centerLabel: "I", color: "#dc2626" },
    { kind: "point", from: "centroid", of: ["A", "B", "C"], label: "G", color: "#16a34a" },
    { kind: "point", from: "orthocenter", of: ["A", "B", "C"], label: "H", color: "#ea580c" },
  ],
};

/** b) Cerc cu 2 tangente dintr-un punct exterior + punctele de tangență marcate. */
const FIG_TANGENTS: FigureSpec2D = {
  points: [
    { id: "O", x: 0, y: 0 },
    { id: "P", x: 5, y: 1.5 },
  ],
  elements: [
    { kind: "circle", id: "c", center: "O", radius: 2.2, centerLabel: "O", color: "#2563eb" },
    { kind: "tangentLines", from: "P", to: "c", pointLabels: ["T_1", "T_2"], color: "#9333ea" },
    { kind: "segment", between: ["O", "P"], color: "#94a3b8" },
  ],
  boundingBox: [-3.5, 4.5, 7.5, -4.5],
};

/** c) Triunghi cu o înălțime + unghiul drept la picior + etichetă de lungime pe o latură. */
const FIG_ALTITUDE: FigureSpec2D = {
  points: [
    { id: "A", x: 0, y: 4 },
    { id: "B", x: -3, y: -1 },
    { id: "C", x: 4, y: -1 },
  ],
  elements: [
    { kind: "polygon", points: ["A", "B", "C"] },
    { kind: "altitude", of: ["A", "B", "C"], from: "A", markRightAngle: true, color: "#ea580c" },
    { kind: "segment", between: ["B", "C"], label: "a", color: "#2563eb" },
  ],
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

function FigureCard({ title, spec, legend }: { title: string; spec: FigureSpec2D; legend: Array<[string, string]> }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="font-medium text-gray-900">{title}</h2>
      <div className="mt-3 flex flex-wrap items-start gap-6">
        <FigureRenderer spec={spec} size={380} />
        <div className="min-w-[220px]">
          <Legend items={legend} />
          <pre className="mt-3 max-w-sm overflow-auto rounded bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">
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
      <h1 className="text-xl font-semibold text-gray-900">Sistem de figuri — vocabular extins</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Relații COMPOZABILE descrise în spec, randate exact de JSXGraph (client-side, SVG). Punctele
        remarcabile, picioarele perpendicularelor și tangentele sunt <em>calculate</em> de motor,
        nu plasate de mână. Zero cost la rulare.
      </p>

      <div className="mt-6 space-y-6">
        <FigureCard
          title="a) Triunghi cu 4 puncte remarcabile + cerc înscris + circumscris (6 concepte)"
          spec={FIG_REMARKABLE}
          legend={[
            ["#0f172a", "triunghi ABC"],
            ["#2563eb", "cerc circumscris, centru O (circumcentru)"],
            ["#dc2626", "cerc înscris, centru I (incentru)"],
            ["#16a34a", "G — centru de greutate (centroid)"],
            ["#ea580c", "H — ortocentru"],
          ]}
        />
        <FigureCard
          title="b) Cerc cu 2 tangente dintr-un punct exterior + puncte de tangență"
          spec={FIG_TANGENTS}
          legend={[
            ["#2563eb", "cerc de centru O"],
            ["#9333ea", "tangentele din P + T₁, T₂ (calculate, nu plasate)"],
            ["#94a3b8", "segment OP"],
          ]}
        />
        <FigureCard
          title="c) Triunghi cu înălțime + unghi drept la picior + lungime pe latură"
          spec={FIG_ALTITUDE}
          legend={[
            ["#0f172a", "triunghi ABC"],
            ["#ea580c", "înălțimea din A + unghiul drept la picior"],
            ["#2563eb", "latura BC cu eticheta de lungime „a”"],
          ]}
        />
      </div>
    </div>
  );
}
