import Figure3DRenderer from "@/components/figures/Figure3DRenderer";
import type { FigureSpec3D } from "@/lib/figures/spec3d";

export const metadata = { title: "Figuri 3D — probă" };

/** Probă: piramidă patrulateră regulată VABCD, latura bazei 24, înălțimea 12. */
const PROBA: FigureSpec3D = {
  body: { kind: "regularPyramid", baseSides: 4, baseEdge: 24, height: 12, labels: ["V", "A", "B", "C", "D"] },
  show: { height: true, dihedral: true },
};

export default function Figuri3DPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Figuri 3D — JSXGraph view3d (probă)</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Același motor ca 2D, dimensiunea 3D NATIVĂ (view3d). Declari corpul + parametri → solverul
        calculează vârfurile → randare. Niciun punct plasat de mână. Interactiv: <em>trage pentru rotație</em>.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Piramidă patrulateră regulată VABCD (latură 24, înălțime 12)</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Înălțimea VO punctată; unghiul diedru față laterală ↔ bază (marcat la M = mijlocul unei laturi, prin
          apotema bazei OM și apotema feței VM), calculat de solver.
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-8">
          <Figure3DRenderer spec={PROBA} size={460} />
          <pre className="max-w-sm overflow-auto rounded bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">
{JSON.stringify(PROBA, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
