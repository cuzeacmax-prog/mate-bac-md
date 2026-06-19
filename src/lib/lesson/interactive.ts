/**
 * interactive.ts — ETAPA 81 FAZA B: LOGICA PURĂ a blocurilor interactive
 * (fără DOM, testabilă în node). Componentele React o consumă; aici trăiește
 * tot ce e determinist și verificabil: substituția parametrului în plot,
 * observabilele curbei, reducerele manipulativelor tactile, dezvăluirea pe pași.
 *
 * R5: niciun conținut matematic generat; substituim un PARAMETRU numeric într-o
 * expresie deja validată (whitelist mathjs din ETAPA 70) și măsurăm curba.
 */

/** Substituie parametrul (ca token întreg) cu valoarea numerică: „a*x^2", a, 2 → „(2)*x^2". */
export function concreteExpr(template: string, param: string, value: number): string {
  const esc = param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return template.replace(new RegExp(`\\b${esc}\\b`, 'g'), `(${value})`);
}

/** Observabile deterministe ale unei curbe eșantionate (pentru afișajul sliderului). */
export interface CurveObservables {
  roots: number; // schimbări de semn pe domeniu ≈ nr. rădăcini reale
  vertex: { x: number; y: number } | null; // extremul (min sau max) cel mai pronunțat
}
export function curveObservables(samples: Array<{ x: number; y: number }>): CurveObservables {
  const valid = samples.filter((p) => Number.isFinite(p.y));
  let roots = 0;
  for (let i = 1; i < valid.length; i++) {
    const a = valid[i - 1].y, b = valid[i].y;
    if (a === 0 || (a < 0 !== b < 0)) roots++;
  }
  if (valid.length === 0) return { roots, vertex: null };
  // vârful = extremul (min sau max global pe domeniu); preferăm cel din interior, nu de la capăt
  const minP = valid.reduce((m, p) => (p.y < m.y ? p : m));
  const maxP = valid.reduce((m, p) => (p.y > m.y ? p : m));
  const interior = (p: { x: number }) => p.x > valid[0].x + 1e-6 && p.x < valid[valid.length - 1].x - 1e-6;
  const vertex = interior(minP) ? minP : interior(maxP) ? maxP : minP;
  return { roots, vertex: { x: Math.round(vertex.x * 100) / 100, y: Math.round(vertex.y * 100) / 100 } };
}

// ───────────────────────── manipulative tactile (reducere pură) ─────────────────────────
/** Aruncă `n` zaruri cu `faces` fețe — întoarce valorile (determinist dat rng). */
export function rollDice(n: number, faces: number, rng: () => number = Math.random): number[] {
  return Array.from({ length: Math.max(1, Math.min(6, n)) }, () => 1 + Math.floor(rng() * faces));
}
/** Extrage o bilă din urnă (compoziție culoare→count); întoarce culoarea + urna rămasă. */
export function drawFromUrn(urn: Record<string, number>, rng: () => number = Math.random): { color: string | null; rest: Record<string, number> } {
  const total = Object.values(urn).reduce((s, n) => s + n, 0);
  if (total <= 0) return { color: null, rest: urn };
  let k = Math.floor(rng() * total);
  for (const [color, n] of Object.entries(urn)) {
    if (k < n) { return { color, rest: { ...urn, [color]: n - 1 } }; }
    k -= n;
  }
  return { color: null, rest: urn };
}
/** Probabilitatea (fracție zecimală) a unei culori în urnă. */
export function urnProbability(urn: Record<string, number>, color: string): number {
  const total = Object.values(urn).reduce((s, n) => s + n, 0);
  return total > 0 ? (urn[color] ?? 0) / total : 0;
}
/** Mută elementul de la `from` la `to` într-o permutare (drag de persoane). */
export function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

// ───────────────────────── dezvăluire pe pași ─────────────────────────
/** O celulă/strat e vizibil dacă pasul-local curent ≥ pasul ei de dezvăluire. */
export const revealedAt = (revealStep: number, currentStep: number): boolean => currentStep >= revealStep;
/** Numărul de pași de dezvăluire (max reveal_at_step + 1). */
export function maxRevealStep(steps: number[]): number {
  return steps.length === 0 ? 0 : Math.max(...steps);
}
