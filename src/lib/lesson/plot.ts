/**
 * plot.ts — ETAPA 70 FAZA B2: blocul plot, VALIDAT și randat determinist.
 *
 * AI-ul CERE graficul ({expr, domain, puncte_marcate}) — nu-l desenează.
 * Serverul: parsează expr cu mathjs și acceptă DOAR noduri din whitelist
 * (fără execuție arbitrară: niciun acces la proprietăți, atribuire, funcții
 * în afara listei). Expresie invalidă → blocul se respinge, lecția continuă.
 * Randarea: eșantionare deterministă → SVG monocrom (motorul theory-figures).
 */
import { create, all, type MathNode } from 'mathjs';
import {
  FIG_H,
  axes,
  curvePath,
  dashed,
  dot,
  label,
  makeMapper,
  svgDoc,
} from './theory-figures/render';

const math = create(all, {});

/** funcțiile permise în expresii (suficiente pentru programa BAC) */
const FN_WHITELIST = new Set([
  'sin', 'cos', 'tan', 'sqrt', 'cbrt', 'abs', 'exp', 'log', 'log10', 'log2', 'ln',
]);
const SYMBOL_WHITELIST = new Set(['x', 'pi', 'e']);
const NODE_WHITELIST = new Set([
  'ConstantNode', 'SymbolNode', 'OperatorNode', 'ParenthesisNode', 'FunctionNode',
]);

export function validatePlotExpr(expr: string): { ok: true; node: MathNode } | { ok: false; error: string } {
  if (expr.length > 120) return { ok: false, error: 'expresie prea lungă' };
  let node: MathNode;
  try {
    node = math.parse(expr);
  } catch (e) {
    return { ok: false, error: `parse: ${e instanceof Error ? e.message : 'invalid'}` };
  }
  let error: string | null = null;
  node.traverse((n: MathNode) => {
    if (error) return;
    if (!NODE_WHITELIST.has(n.type)) {
      error = `nod interzis: ${n.type}`;
      return;
    }
    if (n.type === 'SymbolNode') {
      const name = (n as MathNode & { name: string }).name;
      // numele funcțiilor apar și ca SymbolNode în interiorul FunctionNode
      if (!SYMBOL_WHITELIST.has(name) && !FN_WHITELIST.has(name)) error = `simbol interzis: ${name}`;
    }
    if (n.type === 'FunctionNode') {
      const fname = (n as MathNode & { fn: { name?: string } }).fn?.name ?? '';
      if (!FN_WHITELIST.has(fname)) error = `funcție interzisă: ${fname || '(anonimă)'}`;
    }
    if (n.type === 'OperatorNode') {
      const op = (n as MathNode & { op: string }).op;
      if (!['+', '-', '*', '/', '^'].includes(op)) error = `operator interzis: ${op}`;
    }
  });
  if (error) return { ok: false, error };
  return { ok: true, node };
}

/** randează plotul ca SVG; null dacă expresia/domeniul nu produc nimic desenabil */
export function renderPlotSVG(
  expr: string,
  domain: [number, number],
  marked?: number[]
): { ok: true; svg: string } | { ok: false; error: string } {
  const valid = validatePlotExpr(expr);
  if (!valid.ok) return valid;
  const [a, b] = domain;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b || b - a > 1000) {
    return { ok: false, error: 'domeniu invalid' };
  }
  // ln nu există în mathjs — alias determinist spre log natural
  const compiled = valid.node.compile();
  const scope: Record<string, unknown> = { ln: (v: number) => Math.log(v) };
  const f = (x: number): number => {
    try {
      const y = compiled.evaluate({ ...scope, x });
      return typeof y === 'number' ? y : NaN;
    } catch {
      return NaN;
    }
  };

  // limitele y din eșantionare (percentile ca să nu explodeze pe asimptote)
  const ys: number[] = [];
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const y = f(a + ((b - a) * i) / N);
    if (Number.isFinite(y)) ys.push(y);
  }
  if (ys.length < N / 4) return { ok: false, error: 'funcția nu e definită pe majoritatea domeniului' };
  ys.sort((p, q) => p - q);
  const lo = ys[Math.floor(ys.length * 0.02)];
  const hi = ys[Math.ceil(ys.length * 0.98) - 1];
  const padY = Math.max((hi - lo) * 0.15, 0.5);
  let yMin = lo - padY, yMax = hi + padY;
  // includem axa Ox când e aproape
  if (yMin > 0 && yMin < (yMax - yMin)) yMin = -padY;
  if (yMax < 0 && -yMax < (yMax - yMin)) yMax = padY;

  const padX = (b - a) * 0.08;
  const xMin = a - padX, xMax = b + padX;
  const m = makeMapper(xMin, xMax, yMin, yMax);
  const parts = [axes(m, xMin, xMax, yMin, yMax), curvePath(f, a, b, m, 220)];

  for (const px of (marked ?? []).slice(0, 6)) {
    if (!Number.isFinite(px) || px < a || px > b) continue;
    const py = f(px);
    if (!Number.isFinite(py)) continue;
    parts.push(
      dashed([m.sx(px), m.sy(0)], [m.sx(px), m.sy(py)]),
      dot([m.sx(px), m.sy(py)]),
      label([m.sx(px) - 8, Math.min(m.sy(0) + 18, FIG_H - 6)], formatTick(px), { 'font-size': 12 })
    );
  }
  return { ok: true, svg: svgDoc(parts) };
}

function formatTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
}
