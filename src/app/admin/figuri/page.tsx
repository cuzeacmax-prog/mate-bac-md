import FigureRenderer from "@/components/figures/FigureRenderer";
import type { FigureSpec2D } from "@/lib/figures/spec";

export const metadata = { title: "Figuri — probă" };

/**
 * ETAPA 13 — spec de probă: triunghi ABC care COMPUNE concepte:
 *   - cercul CIRCUMSCRIS (prin A,B,C, centru O) — albastru;
 *   - cercul ÎNSCRIS (tangent la laturi, centru I) — roșu.
 * Tangența și centrele sunt CALCULATE de JSXGraph din relații, nu plasate de mână.
 */
const PROBA: FigureSpec2D = {
  points: [
    { id: "A", x: -3, y: -2 },
    { id: "B", x: 4, y: -2 },
    { id: "C", x: 1, y: 4 },
  ],
  elements: [
    { kind: "polygon", points: ["A", "B", "C"] },
    { kind: "circumcircle", of: ["A", "B", "C"], centerLabel: "O", color: "#2563eb" },
    { kind: "incircle", of: ["A", "B", "C"], centerLabel: "I", color: "#dc2626" },
  ],
};

export default function FiguriPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Sistem de figuri — probă</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Figura e descrisă printr-o <strong>specificație</strong> (puncte + relații), iar JSXGraph o
        randează exact, client-side, în SVG. Cercul înscris e tangent la laturi prin <em>calcul</em>,
        nu aproximat. Zero cost la rulare, fără server.
      </p>

      <div className="mt-6 flex flex-wrap items-start gap-8">
        <FigureRenderer spec={PROBA} size={460} />

        <div className="text-sm text-gray-700">
          <h2 className="font-medium text-gray-900">Probă: triunghi compus</h2>
          <ul className="mt-2 space-y-1">
            <li>
              <span className="inline-block h-2 w-4 align-middle" style={{ background: "#0f172a" }} />{" "}
              triunghi <strong>ABC</strong> (poligon)
            </li>
            <li>
              <span className="inline-block h-2 w-4 align-middle" style={{ background: "#2563eb" }} />{" "}
              cerc <strong>circumscris</strong>, centru O
            </li>
            <li>
              <span className="inline-block h-2 w-4 align-middle" style={{ background: "#dc2626" }} />{" "}
              cerc <strong>înscris</strong>, centru I (tangent la laturi)
            </li>
          </ul>
          <pre className="mt-4 max-w-md overflow-auto rounded bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
{JSON.stringify(PROBA, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
