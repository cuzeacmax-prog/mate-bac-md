/**
 * ETAPA 46 — EXTRACȚIA pe care o furnizează Claude Code (abonament, NU API în app) pentru coada de autorat.
 * Mapează condiția (text liber din web) la intrarea de pipeline (relații + numere, ZERO coordonate).
 * Pentru clasa con-secțiune: parsează numerele din enunț (volum, înălțime, distanță) → coneCut.
 * Necunoscut → null (cazul rămâne marcat „extracție necesară"); adaug aici clasa nouă când o întâlnesc.
 */
import type { PipelineInput, DesiredDescriptor } from "../../src/lib/figures/authoring";

export function resolveInput(condition: string): { input: PipelineInput; desired?: DesiredDescriptor } | null {
  const c = condition.toLowerCase();
  const num = (re: RegExp): number | null => { const m = c.match(re); return m ? parseFloat(m[1].replace(",", ".")) : null; };

  // ── con + plan paralel cu baza la o distanță de vârf → secțiune (distanță punct–plan = perpendiculara) ──
  if (c.includes("con") && c.includes("plan") && (c.includes("vârf") || c.includes("varf"))) {
    const H = num(/[iî]n[aă]l[tț]ime[a]?\s*(?:de\s*|egal[aă]\s*cu\s*)?(\d+(?:[.,]\d+)?)/);
    const volCoef = num(/volum(?:ul)?\s*(?:de\s*|egal\s*cu\s*)?(\d+(?:[.,]\d+)?)\s*π/);
    const dist = num(/distan[tț]a\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/);
    if (H && volCoef && dist) {
      const R = Math.sqrt((3 * volCoef) / H); // V=(1/3)πR²H, V=volCoef·π ⇒ R=√(3·volCoef/H)
      const dStr = Number.isInteger(dist) ? String(dist) : String(dist);
      return {
        input: { kind: "coneCut", cone: { radius: R, height: H }, by: { rel: "distanceApexToParallelPlane", value: dist } },
        desired: { dim: "3D", orientation: "apex-sus", mustLabels: ["V", "O", dStr], minPolylines: 6 },
      };
    }
  }
  return null;
}
