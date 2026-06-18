/**
 * compare.ts — ETAPA 63 P2 (Nivel A): comparație deterministă răspuns elev ↔
 * răspuns oficial din culegere (linkurile 'strict-bijectiv').
 *
 * Pipeline: LaTeX/text → normalizare → mathjs.
 *  - numeric: |a−b| ≤ toleranță relativă 1e-3 (sau absolută 1e-9 lângă 0)
 *  - expresii: simplify(a − b) → 0 (mathjs)
 *  - litere de variantă: potrivire exactă
 * Orice nu se poate compara determinist → verdict null (cade pe Nivelul B).
 */
import { create, all, type MathNode } from "mathjs";

const math = create(all, {});

export type CompareVerdict = { comparable: true; correct: boolean } | { comparable: false };

/** LaTeX-ul culegerii / textul elevului → expresie parsabilă de mathjs. */
export function normalizeMathExpression(input: string): string {
  let s = input.trim();

  // delimitatori KaTeX + punct final
  s = s.replace(/\$\$?/g, "").replace(/\\\(|\\\)|\\\[|\\\]/g, "").trim();
  s = s.replace(/[.;]\s*$/, "");

  // ia membrul drept al ultimei egalități ("E = 2" → "2"; "V = \pi^2 (u.c)" → "\pi^2 (u.c)")
  const eqIdx = s.lastIndexOf("=");
  if (eqIdx >= 0 && eqIdx < s.length - 1) s = s.slice(eqIdx + 1).trim();

  // comenzi LaTeX uzuale
  s = s.replace(/\\dfrac|\\tfrac|\\frac/g, "\\frac");
  // INTERLEAVE sqrt ↔ frac repetat: rezolvă √ în numărător/numitor de fracție
  // (ex. \frac{2+\sqrt{3}}{2}) — fracția nu se reduce până nu cade √-ul interior.
  for (let i = 0; i < 6 && /\\(frac|sqrt)/.test(s); i++) {
    s = s.replace(/\\sqrt\[3\]\s*\{([^{}]*)\}/g, "cbrt($1)");
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)");
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
  }
  s = s.replace(/\\cdot|\\times/g, "*");
  s = s.replace(/\\pi/g, "pi");
  s = s.replace(/\\ln/g, "log");
  s = s.replace(/\\left|\\right/g, "");
  // \text{...} = unități/proză; consumă și exponentul lipit (\text{ cm}^2 → nimic)
  s = s.replace(/\\text\s*\{[^{}]*\}\s*(\^\s*\{?\s*[0-9]+\s*\}?|[²³])?/g, "");
  s = s.replace(/\\[,;!:]|\\ /g, " "); // spațiere LaTeX → spațiu (separă numărul de unitate)
  s = s.replace(/\\mathrm\s*\{([^{}]*)\}/g, "$1");

  // unități de măsură uzuale (cu sau fără exponent) + "(u.c.)" / "(u.m.)" / "u.c."
  s = s.replace(/\(?\s*u\.?\s*[cm]\.?\s*\)?\s*$/i, "");
  s = s.replace(/(\d|\b)\s*(cm|dm|mm|km|m)\s*(\^\s*[23]|[²³])?\s*$/i, "$1");
  s = s.replace(/\b(grade|lei|ore|minute)\s*$/i, "");

  // simboluri Unicode
  s = s.replace(/√(\d+|\w)/g, "sqrt($1)");
  s = s.replace(/π/g, "pi").replace(/²/g, "^2").replace(/³/g, "^3");
  s = s.replace(/[−–]/g, "-").replace(/×/g, "*").replace(/÷/g, "/");

  // virgula zecimală românească: "0,5" → "0.5" (doar între cifre)
  s = s.replace(/(\d),(\d)/g, "$1.$2");

  // ^{ab} → ^(ab)
  s = s.replace(/\^\s*\{([^{}]*)\}/g, "^($1)");
  // acolade rămase → paranteze
  s = s.replace(/\{/g, "(").replace(/\}/g, ")");

  return s.trim();
}

/**
 * Evaluează un scalar LaTeX/Unicode la număr (reutilizat de verificarea CAS,
 * ETAPA 79): aplică `normalizeMathExpression` + mathjs. `null` dacă expresia nu
 * e un scalar numeric determinist (conține variabile, e neparsabilă etc.).
 * Marcajele de grade (°, \circ) sunt eliminate înainte de evaluare.
 */
export function evalLatexScalar(input: string): number | null {
  const stripped = input.replace(/\\,?\^?\\?circ|°|\^\{?\\circ\}?/g, "");
  const node = tryParse(normalizeMathExpression(stripped));
  return node ? tryEvalNumeric(node) : null;
}

function tryParse(expr: string): MathNode | null {
  if (!expr) return null;
  try {
    return math.parse(expr);
  } catch {
    return null;
  }
}

function tryEvalNumeric(node: MathNode): number | null {
  try {
    const v: unknown = node.evaluate({});
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * Compară determinist. Verdict doar când AMBELE părți se parsează:
 * întâi numeric (toleranță), apoi echivalență simbolică (simplify(a−b)=0).
 */
export function compareAnswers(official: string, student: string): CompareVerdict {
  const offS = official.trim();
  const stuS = student.trim();
  if (!offS || !stuS) return { comparable: false };

  // litere de variantă (a-d) — exact
  const offLetter = offS.match(/^([a-dA-D])[).\s]*$/);
  const stuLetter = stuS.match(/^([a-dA-D])[).\s]*$/);
  if (offLetter || stuLetter) {
    if (offLetter && stuLetter) {
      return { comparable: true, correct: offLetter[1].toLowerCase() === stuLetter[1].toLowerCase() };
    }
    return { comparable: false };
  }

  const offNorm = normalizeMathExpression(offS);
  const stuNorm = normalizeMathExpression(stuS);
  const offNode = tryParse(offNorm);
  const stuNode = tryParse(stuNorm);
  if (!offNode || !stuNode) return { comparable: false };

  // 1) numeric cu toleranță
  const offVal = tryEvalNumeric(offNode);
  const stuVal = tryEvalNumeric(stuNode);
  if (offVal !== null && stuVal !== null) {
    const tol = Math.max(1e-9, Math.abs(offVal) * 1e-3);
    return { comparable: true, correct: Math.abs(offVal - stuVal) <= tol };
  }
  // doar una e numerică → nu-s echivalente ca formă; lasă judecătorul să decidă
  if ((offVal === null) !== (stuVal === null)) return { comparable: false };

  // 2) echivalență simbolică: simplify(a - b) == 0
  try {
    const diff = math.simplify(`(${offNorm}) - (${stuNorm})`);
    if (diff.toString() === "0") return { comparable: true, correct: true };
    // diferență constantă nenulă → sigur diferit
    const dv = tryEvalNumeric(diff);
    if (dv !== null) return { comparable: true, correct: Math.abs(dv) <= 1e-9 };
    // diferența conține variabile → eșantionare numerică pe câteva puncte
    const vars = new Set<string>();
    diff.traverse((node) => {
      if (node.type === "SymbolNode" && !["pi", "e"].includes(node.toString())) {
        vars.add(node.toString());
      }
    });
    if (vars.size > 0 && vars.size <= 2) {
      const samples = [0.7, 1.3, 2.1];
      let allZero = true;
      let evaluated = 0;
      for (const v1 of samples) {
        for (const v2 of samples) {
          const scope: Record<string, number> = {};
          const arr = Array.from(vars);
          scope[arr[0]] = v1;
          if (arr[1]) scope[arr[1]] = v2;
          try {
            const r: unknown = diff.evaluate(scope);
            if (typeof r === "number" && Number.isFinite(r)) {
              evaluated++;
              if (Math.abs(r) > 1e-6) allZero = false;
            }
          } catch {
            // punct în afara domeniului — sărit
          }
        }
      }
      if (evaluated >= 3) return { comparable: true, correct: allZero };
    }
  } catch {
    // simplify a eșuat — nu putem decide determinist
  }
  return { comparable: false };
}
