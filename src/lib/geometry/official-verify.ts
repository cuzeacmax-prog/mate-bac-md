/**
 * official-verify.ts — ETAPA 79 FAZA A: VERIFICARE CAS a geometriei (Modulele V-VI)
 * contra răspunsurilor OFICIALE din culegere.
 *
 * Principiul (R5 absolut — ZERO matematică rescrisă de model):
 *  1. RECUNOAȘTERE DETERMINISTĂ a formei + parametrilor din enunț (regex pe
 *     cuvinte-cheie românești + LaTeX). Niciun LLM în buclă.
 *  2. REZOLVARE deterministă (closed-form / reducere 1D), în spiritul geometry
 *     CAS (cas.ts): toate cantitățile din relațiile tipate ale formei.
 *  3. COMPARAȚIE cu răspunsul oficial prin normalizatorul matur din ETAPA 63
 *     (`compareAnswers`, mathjs) — tratează 4√3 ≡ 6.928, 36π ≡ 113.097,
 *     fracții ≡ zecimale, ordine etc.
 *
 * Trei verdicte ONESTE:
 *  • VERIFICAT          — cantitatea calculată reproduce răspunsul oficial;
 *  • NECONCORDANT       — recunoaștere SIGURĂ + există candidat numeric oficial,
 *                         dar NICIO valoare calculată nu se potrivește → arbitraj uman;
 *  • NEREZOLVABIL-CAS   — solverul nu acoperă forma SAU normalizatorul nu poate
 *                         compara cert (A2: nu declarăm neconcordant nesigur).
 */
import { compareAnswers, evalLatexScalar } from "@/lib/evaluare/compare";

export type GeoVerdict = "verificat" | "neconcordant" | "nerezolvabil-cas";

export interface ComputedQuantity {
  label: string;
  /** valoare numerică (cu π deja încorporat dacă e cazul) */
  value: number;
  /** redare lizibilă pentru raport (ex. „20π", „13", „5√3") */
  latex: string;
}

export interface GeoVerifyResult {
  verdict: GeoVerdict;
  method: string;
  shape: string | null;
  /** cantitățile cerute, calculate de CAS */
  computed: ComputedQuantity[];
  /** răspunsul CAS principal, ca text (pentru persistare + lista de arbitraj) */
  computedLatex: string | null;
  note: string;
  /** pentru gruparea NEREZOLVABIL pe capabilități lipsă (A4) */
  capability: string | null;
}

/** Ieșirea unui solver de formă: rezolvat (cantități) sau neacoperit (capabilitate lipsă). */
type SolveOutput =
  | { kind: "solved"; shape: string; method: string; asked: ComputedQuantity[]; confident: boolean }
  | { kind: "unsupported"; shape: string | null; capability: string };

// ───────────────────────── tokenizare enunț ─────────────────────────
interface Token { index: number; raw: string; value: number | null; isAngle: boolean }

/** Token-urile numerice dintr-un enunț: `$...$` cu cifre + numere goale (cu/fără `°`). */
function tokenize(statement: string): Token[] {
  const toks: Token[] = [];
  const reMath = /\$([^$]+)\$/g;
  let m: RegExpExecArray | null;
  while ((m = reMath.exec(statement)) !== null) {
    const inner = m[1];
    if (!/\d/.test(inner)) continue;
    toks.push({ index: m.index, raw: inner, value: evalLatexScalar(inner), isAngle: /°|\\circ/.test(inner) });
  }
  const rePlain = /(\d+(?:[.,]\d+)?)\s*(°|\\circ)?/g;
  while ((m = rePlain.exec(statement)) !== null) {
    if (toks.some((t) => m!.index >= t.index && m!.index < t.index + t.raw.length + 2)) continue;
    const num = parseFloat(m[1].replace(",", "."));
    if (!Number.isFinite(num)) continue;
    toks.push({ index: m.index, raw: m[0].trim(), value: num, isAngle: !!m[2] });
  }
  return toks.sort((a, b) => a.index - b.index);
}

/** Prima valoare numerică DUPĂ poziția `from` (filtrabilă pe unghi). */
function valueAfter(toks: Token[], from: number, opts?: { angle?: boolean }): number | null {
  for (const t of toks) {
    if (t.index < from) continue;
    if (opts?.angle && !t.isAngle) continue;
    if (!opts?.angle && t.isAngle) continue;
    if (t.value !== null) return t.value;
  }
  return null;
}

/** Indexul de DUPĂ prima potrivire a regex-ului (sau -1). */
function at(statement: string, re: RegExp): number {
  const m = re.exec(statement);
  return m ? m.index + m[0].length : -1;
}

// ───────────────────────── comparație cu oficialul ─────────────────────────
/** Sparge răspunsul oficial în bucăți candidate (pe `;`, `\\`, `\quad`, `. `, virgule de listă). */
function splitOfficial(official: string): string[] {
  return official
    .replace(/\\\\|\\quad|\\qquad/g, ";")
    .replace(/(\^?\d|\})\s*\.\s+/g, "$1;") // „...cm^3. Nu..." → separator
    .split(/;|,\s*\\;|,(?=\s*[A-Za-z]\w*\s*=)/)
    .map((s) => s.replace(/°|\\circ/g, "").replace(/^[,;\s]+|[,;\s]+$/g, "").trim())
    .filter(Boolean);
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toPrecision(12);
}

/** O valoare calculată se potrivește cu vreo bucată oficială? (toleranța lui compareAnswers) */
function matchesOfficial(pieces: string[], value: number): boolean {
  const s = fmt(value);
  return pieces.some((p) => { const v = compareAnswers(p, s); return v.comparable && v.correct; });
}

/** prettify: dacă valoarea ≈ k·π cu k „curat", redă „kπ"; altfel zecimal. */
function piTimes(v: number): string {
  const k = v / Math.PI;
  const kr = Math.round(k * 1e6) / 1e6;
  if (Math.abs(k - kr) < 1e-6 && Math.abs(kr) < 1e5) return `${kr}π`;
  return v.toFixed(4);
}

function bisect(F: (t: number) => number, lo: number, hi: number): number | null {
  const N = 2000;
  let prev = lo, fprev: number;
  try { fprev = F(prev); } catch { return null; }
  for (let i = 1; i <= N; i++) {
    const cur = lo + (hi - lo) * i / N;
    let fcur: number;
    try { fcur = F(cur); } catch { prev = cur; continue; }
    if (Number.isFinite(fprev) && Number.isFinite(fcur) && fprev * fcur <= 0) {
      let a = prev, b = cur, fa = fprev;
      for (let k = 0; k < 100; k++) {
        const mid = (a + b) / 2; const fm = F(mid);
        if (!Number.isFinite(fm)) break;
        if (fa * fm <= 0) b = mid; else { a = mid; fa = fm; }
      }
      return (a + b) / 2;
    }
    prev = cur; fprev = fcur;
  }
  return null;
}

// ═══════════════════════════ SOLVER: CON CIRCULAR DREPT ═══════════════════════════
/** Cantitate = C(t)·R^n, cu t=H/R, s=√(1+t²)=g/R. */
interface ConeConstraint { n: number; C: (t: number) => number; value: number }
const sOf = (t: number) => Math.sqrt(1 + t * t);

/** Specificația unei cantități de con: cuvânt-cheie + exponentul R + coeficientul C(t). */
interface ConeKw { kind: string; re: RegExp; n: number; C: (t: number) => number }
const CONE_KWS: ConeKw[] = [
  { kind: "R", re: /raz[ăa]\s+(a\s+)?baz|raza\s+conului|raza\s+baz/i, n: 1, C: () => 1 },
  { kind: "H", re: /[îi]n[ăa]l[țt]im(e|ea)/i, n: 1, C: (t) => t },
  { kind: "g", re: /generatoare(a)?/i, n: 1, C: (t) => sOf(t) },
  { kind: "perim", re: /perimetr(u|ul)/i, n: 1, C: (t) => 2 * (1 + sOf(t)) },
  { kind: "A_lat", re: /aria\s+(suprafe[țt]ei\s+)?lateral|arie\s+lateral/i, n: 2, C: (t) => Math.PI * sOf(t) },
  { kind: "A_tot", re: /aria\s+(suprafe[țt]ei\s+)?total|arie\s+total/i, n: 2, C: (t) => Math.PI * (1 + sOf(t)) },
  { kind: "A_base", re: /aria\s+baz/i, n: 2, C: () => Math.PI },
  { kind: "V_given", re: /volum/i, n: 3, C: (t) => Math.PI * t / 3 },
];

function solveCone(statement: string): SolveOutput {
  const s = statement;
  const toks = tokenize(s);
  const scale: ConeConstraint[] = [];
  let tFixed: number | null = null;
  const given = new Set<string>();

  // relații-rație (fixează t) — secțiunea axială specială sau un unghi
  if (/sec[țt]iun(e|ea)\s+axial[ăa][^.]*echilateral|con\s+echilater|con\s+equilater|triunghi\s+echilateral/i.test(s)) tFixed = Math.sqrt(3);
  else if (/sec[țt]iun(e|ea)\s+axial[ăa][^.]*dreptunghic|triunghi\s+dreptunghic/i.test(s)) tFixed = 1;
  if (/unghi(ului)?\s+(de\s+)?la\s+v[âaî]rf|v[âaî]rful\s+sec[țt]iun/i.test(s)) {
    const phi = valueAfter(toks, 0, { angle: true });
    if (phi) { const half = (phi / 2) * Math.PI / 180; tFixed = Math.sqrt(1 / Math.sin(half) ** 2 - 1); }
  } else if (tFixed === null && /unghi/i.test(s) && /plan(ul)?\s+(ei\s+)?baz|cu\s+baza|la\s+baz/i.test(s)) {
    // unghiul dintre generatoare și planul bazei (ordine indiferentă) = α → t = tanα
    const a = valueAfter(toks, 0, { angle: true });
    if (a) tFixed = Math.tan(a * Math.PI / 180);
  }

  // ── constrângeri de scară: leagă fiecare cuvânt-cheie de PRIMUL token DINAINTEA
  //    următorului cuvânt-cheie (evită ca „aria laterală" să fure numărul lui „aria totală"). ──
  const found = CONE_KWS.map((k) => { const m = k.re.exec(s); return m ? { ...k, start: m.index, end: m.index + m[0].length } : null; })
    .filter((x): x is ConeKw & { start: number; end: number } => x !== null)
    .sort((a, b) => a.start - b.start);
  for (let i = 0; i < found.length; i++) {
    const kw = found[i];
    // valoarea se leagă DOAR în propoziția cuvântului-cheie (până la următorul `.`/`?`)
    // și înainte de următorul cuvânt-cheie — evită citațiile/anii din altă propoziție.
    const period = s.slice(kw.end).search(/[.?]/);
    const sentenceEnd = period >= 0 ? kw.end + period : Infinity;
    const limit = Math.min(i + 1 < found.length ? found[i + 1].start : Infinity, sentenceEnd);
    const tok = toks.find((t) => !t.isAngle && t.index >= kw.end && t.index < limit && t.value !== null);
    if (tok && tok.value! > 0) { scale.push({ n: kw.n, C: kw.C, value: tok.value! }); given.add(kw.kind); }
  }

  // rezolvă (R, t)
  let R: number | null = null, t: number | null = tFixed;
  if (t !== null) {
    if (scale.length > 0) { const c = scale[0]; R = Math.pow(c.value / c.C(t), 1 / c.n); }
  } else if (scale.length >= 2) {
    const [a, b] = scale;
    const F = (tt: number) => Math.log(a.value / a.C(tt)) / a.n - Math.log(b.value / b.C(tt)) / b.n;
    t = bisect(F, 1e-3, 200);
    if (t !== null) R = Math.pow(a.value / a.C(t), 1 / a.n);
  }
  if (t === null) return { kind: "unsupported", shape: "con", capability: "con: parametri insuficienți / formă specială" };
  const s_ = sOf(t);

  // ce se cere?
  const asked: ComputedQuantity[] = [];
  const av = (re: RegExp) => re.test(s);
  if (av(/raport(ul)?[^.]*(total|lateral)/i)) asked.push({ label: "A_tot/A_lat", value: (1 + s_) / s_, latex: ((1 + s_) / s_).toFixed(4) });
  if (av(/unghi[^.]*(sector|la\s+centru)|desf[ăa][șs]urat[ăa]/i) && av(/sector|desf[ăa][șs]ur/i)) {
    const sector = 360 / s_; asked.push({ label: "unghi sector", value: sector, latex: `${sector.toFixed(2)}` });
  }
  if (R !== null) {
    const g = R * s_, H = R * t;
    if (av(/aria\s+(acestei\s+)?sec[țt]iun/i) && av(/axial/i)) asked.push({ label: "aria secțiunii axiale", value: R * H, latex: (R * H).toFixed(4) });
    if (av(/generatoare/i) && !given.has("g")) asked.push({ label: "generatoare", value: g, latex: g.toFixed(6) });
    if (av(/lungimea\s+razei|raza\s+baz/i) && !given.has("R") && av(/afl|determin|calcul|s[ăa]\s+se\s+afle/i)) asked.push({ label: "rază", value: R, latex: R.toFixed(6) });
    if (av(/[îi]n[ăa]l[țt]im/i) && !given.has("H") && av(/afl|determin|calcul/i) && !asked.length) asked.push({ label: "înălțime", value: H, latex: H.toFixed(6) });
    if (av(/volum/i) && !given.has("V_given")) asked.push({ label: "volum", value: Math.PI * R * R * H / 3, latex: piTimes(Math.PI * R * R * H / 3) });
    if (av(/aria\s+(suprafe[țt]ei\s+)?lateral/i) && !given.has("A_lat")) asked.push({ label: "aria laterală", value: Math.PI * R * g, latex: piTimes(Math.PI * R * g) });
    if (av(/aria\s+(suprafe[țt]ei\s+)?total/i) && !given.has("A_tot")) asked.push({ label: "aria totală", value: Math.PI * R * (R + g), latex: piTimes(Math.PI * R * (R + g)) });
  }
  if (asked.length === 0) return { kind: "unsupported", shape: "con", capability: "con: cantitate cerută nerecunoscută" };
  return { kind: "solved", shape: "con", method: "cas_geometry_cone", asked, confident: true };
}

// ═══════════════════════════ SOLVER: TETRAEDRU REGULAT ═══════════════════════════
function solveRegularTetra(statement: string): SolveOutput {
  const s = statement;
  if (/complet(a[țt]i|[ăa]m)\s+(spa[țt]iile|tabelul)|tabelul\s+(de\s+mai\s+jos|urm[ăa]tor)/i.test(s) || /\\begin\{array\}|\|---/.test(s))
    return { kind: "unsupported", shape: "tetraedru", capability: "tabel multi-parametru (solver de tabel)" };
  if (/dou[ăa]\s+tetraedre/i.test(s)) return { kind: "unsupported", shape: "tetraedru", capability: "raport între două corpuri" };

  const toks = tokenize(s);
  let a: number | null = null;
  let startKind = "";
  const tryFrom = (re: RegExp, inv: (v: number) => number, kind: string) => {
    if (a !== null) return; const idx = at(s, re); if (idx < 0) return;
    const v = valueAfter(toks, idx); if (v && v > 0) { a = inv(v); startKind = kind; }
  };
  tryFrom(/[îi]n[ăa]l[țt]im/i, (h) => h * 3 / Math.sqrt(6), "H");
  tryFrom(/desf[ăa][șs]ur[ăa]r/i, (A) => Math.sqrt(A / Math.sqrt(3)), "A_tot");
  tryFrom(/aria\s+total|arie\s+total/i, (A) => Math.sqrt(A / Math.sqrt(3)), "A_tot");
  tryFrom(/muchi(a|e)/i, (m) => m, "a");
  if (a === null) return { kind: "unsupported", shape: "tetraedru", capability: "tetraedru: parametru de pornire nerecunoscut" };

  const aa = a;
  const h = aa * Math.sqrt(6) / 3, Atot = Math.sqrt(3) * aa * aa, Alat = 3 * Math.sqrt(3) / 4 * aa * aa, V = aa ** 3 / (6 * Math.sqrt(2));
  const asked: ComputedQuantity[] = [];
  const av = (re: RegExp) => re.test(s);
  if (av(/volum/i)) asked.push({ label: "volum", value: V, latex: V.toFixed(4) });
  if (av(/aria\s+total/i) && startKind !== "A_tot") asked.push({ label: "aria totală", value: Atot, latex: Atot.toFixed(4) });
  if (av(/aria\s+lateral/i)) asked.push({ label: "aria laterală", value: Alat, latex: Alat.toFixed(4) });
  if (av(/[îi]n[ăa]l[țt]im/i) && startKind !== "H" && asked.length === 0) asked.push({ label: "înălțime", value: h, latex: h.toFixed(4) });
  // capacitate („încap … ml?") → mărimea relevantă e volumul
  if (asked.length === 0 && /\bml\b|litri|[îi]ncap|capacit/i.test(s)) asked.push({ label: "volum", value: V, latex: V.toFixed(4) });
  if (asked.length === 0) return { kind: "unsupported", shape: "tetraedru", capability: "tetraedru: cantitate cerută nerecunoscută" };
  return { kind: "solved", shape: "tetraedru", method: "cas_geometry_tetra", asked, confident: true };
}

// ═══════════════════════════ ORCHESTRATOR ═══════════════════════════
function nerez(shape: string | null, capability: string): GeoVerifyResult {
  return { verdict: "nerezolvabil-cas", method: "cas_geometry", shape, computed: [], computedLatex: null, note: capability, capability };
}

function decide(out: Extract<SolveOutput, { kind: "solved" }>, official: string): GeoVerifyResult {
  const { shape, method, asked, confident } = out;
  const pieces = splitOfficial(official);
  const numericPieces = pieces.filter((p) => evalLatexScalar(p) !== null);
  const results = asked.map((q) => ({ q, matched: matchesOfficial(pieces, q.value) }));
  const allMatched = results.length > 0 && results.every((r) => r.matched);
  const anyMatched = results.some((r) => r.matched);
  const computedStr = asked.map((q) => `${q.label}=${q.latex}`).join(", ");

  if (allMatched) {
    return { verdict: "verificat", method, shape, computed: asked, computedLatex: (results.find((r) => r.matched)?.q ?? asked[0]).latex, note: `CAS reproduce oficialul: ${computedStr}`, capability: null };
  }
  if (confident && numericPieces.length > 0) {
    if (anyMatched) return { verdict: "verificat", method, shape, computed: asked, computedLatex: (results.find((r) => r.matched)!.q).latex, note: `CAS reproduce (parțial) oficialul: ${computedStr}`, capability: null };
    return { verdict: "neconcordant", method, shape, computed: asked, computedLatex: asked[0].latex, note: `CAS dă ${computedStr}; oficial: ${pieces.join(" | ").slice(0, 240)}`, capability: null };
  }
  return { verdict: "nerezolvabil-cas", method, shape, computed: asked, computedLatex: asked[0]?.latex ?? null,
    capability: "răspuns oficial neparsabil determinist (posibil mis-legat)",
    note: `CAS a calculat ${computedStr}, dar răspunsul oficial nu e comparabil determinist` };
}

function dispatch(statement: string): SolveOutput {
  const s = statement;
  if (/trunchi\s+de\s+(piramid|con)/i.test(s)) return { kind: "unsupported", shape: "trunchi", capability: "trunchi de piramidă/con (frustum) — operator de frustum neimplementat" };
  if (/tetraedr/i.test(s)) return solveRegularTetra(s);
  if (/\bcon\b|conul(ui)?|con\s+circular|con\s+echilater/i.test(s) && !/concept|continu|context/i.test(s)) return solveCone(s);
  if (/piramid/i.test(s)) return { kind: "unsupported", shape: "piramidă", capability: "piramidă — solver neimplementat în FAZA A" };
  if (/paralelipiped/i.test(s)) return { kind: "unsupported", shape: "paralelipiped", capability: "paralelipiped drept — solver neimplementat în FAZA A" };
  if (/prism[ăa]/i.test(s)) return { kind: "unsupported", shape: "prismă", capability: "prismă — solver neimplementat în FAZA A" };
  return { kind: "unsupported", shape: null, capability: "formă geometrică nerecunoscută" };
}

/** Punctul de intrare: verifică un exercițiu de geometrie contra răspunsului oficial. */
export function verifyGeometry(statement: string, official: string): GeoVerifyResult {
  // elimină citațiile de tip „*(BAC, 1999, profil umanist)*" — ani/surse care
  // ar fi legate greșit ca valori numerice ale unei cantități.
  const clean = statement.replace(/\*\([^)]*\)\*/g, " ").replace(/\((?:BAC|bac)[^)]*\)/g, " ");
  const out = dispatch(clean);
  if (out.kind === "unsupported") return nerez(out.shape, out.capability);
  return decide(out, official);
}
