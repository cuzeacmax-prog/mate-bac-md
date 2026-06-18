/**
 * body-render.ts — ETAPA 79 FAZA B: detectorul de SCURGERI de randare (clasa, nu
 * instanța) + sanitizer MECANIC SIGUR. Reutilizat de:
 *   - scriptul de triere (etapa79-body-triage),
 *   - coada umană din /admin/continut (API + UI),
 *   - (sursa-unică-adevăr a pipeline-ului din etapa74-render-audit).
 *
 * R5: sanitizer-ul face DOAR transformări STRUCTURALE (delimitatori, tabular→array)
 * care NU schimbă conținutul matematic. Orice rămâne stricat după sanitizer →
 * COADĂ UMANĂ (Maxim editează; modelul NU rescrie matematica).
 */
import katex from "katex";
import { segmentDelimitedMath, delimitBareMath, segmentMath } from "@/lib/content-math";
import { extractMarkdownTable } from "@/lib/content/markdown-table";
import { KATEX_MACROS, tabularToArray } from "@/lib/content/katex-macros";

export interface BodyFormulaError { raw: string; message: string; display: boolean }

/**
 * Erorile KaTeX per-formulă ale unui enunț, în segmentarea pe care o vede
 * editorul (segmentMath). Folosit de coada umană din /admin/continut ca să
 * EVIDENȚIEZE eroarea (R5: nu rescrie matematica, doar arată unde e ruptă).
 */
export function findBodyErrors(statement: string): BodyFormulaError[] {
  const errs: BodyFormulaError[] = [];
  for (const seg of segmentMath(statement)) {
    if (seg.type !== "math") continue;
    try {
      katex.renderToString(tabularToArray(seg.value), { displayMode: seg.display, throwOnError: true, strict: false, trust: false, macros: KATEX_MACROS });
    } catch (e) {
      errs.push({ raw: seg.value, message: (e instanceof Error ? e.message : "eroare KaTeX").replace(/^KaTeX parse error:\s*/, ""), display: seg.display });
    }
  }
  return errs;
}

export const LEAK_CLASSES: Array<{ name: string; re: RegExp }> = [
  { name: "begin{", re: /\\begin\{/ },
  { name: "display-[", re: /\\\[/ },
  { name: "hline", re: /\\hline/ },
  { name: "|---|", re: /\|\s*:?-{3,}/ },
  { name: "$-ramas", re: /\$/ },
  { name: "&-multiplu", re: /^[^\n]*&[^&\n]*&/m },
  { name: "caret-brut", re: /[A-Za-z0-9)\]]\^[A-Za-z0-9({[+\-]/ },
  { name: "indice-brut", re: /[A-Za-z]_[A-Za-z0-9({]/ },
  { name: "comanda-bruta", re: /\\[a-zA-Z]{2,}/ },
];

/** ce VEDE elevul după MathText: text + fallback-urile formulelor eșuate */
export function mathTextVisible(text: string): string {
  let out = "";
  for (const seg of segmentDelimitedMath(delimitBareMath(text))) {
    if (seg.type === "text") { out += seg.value; continue; }
    try {
      katex.renderToString(tabularToArray(seg.value), { displayMode: seg.display, throwOnError: true, strict: false, trust: false, macros: KATEX_MACROS });
    } catch {
      out += seg.raw ?? seg.value;
    }
  }
  return out;
}

/** pipeline-ul StatementText: tabelul extras nativ, restul prin MathText */
export function statementVisible(text: string): string {
  const t = extractMarkdownTable(text);
  if (!t) return mathTextVisible(text);
  const parts: string[] = [];
  if (t.before) parts.push(mathTextVisible(t.before));
  parts.push(...t.columns.map(mathTextVisible));
  for (const row of t.rows) parts.push(...row.map(mathTextVisible));
  if (t.after) parts.push(mathTextVisible(t.after));
  return parts.join("\n");
}

export function leakClasses(visible: string): string[] {
  return LEAK_CLASSES.filter((c) => c.re.test(visible)).map((c) => c.name);
}

/** Enunțul se randează curat (nicio scurgere pe textul vizibil)? */
export function rendersClean(statement: string): boolean {
  return leakClasses(statementVisible(statement)).length === 0;
}

/**
 * Sanitizer MECANIC (R5-sigur): transformări STRUCTURALE care nu ating matematica.
 *  1. tabular → array (KaTeX nu cunoaște tabular; array randează identic);
 *  2. normalizare delimitatori: \[..\] → $$..$$, \(..\) → $..$;
 *  3. mediu de display ne-delimitat (\begin{array|aligned|cases|matrix}…\end{…})
 *     în AFARA oricărui $  → înfășurat în $$…$$ ca să se randeze.
 * Nu adaugă/șterge simboluri matematice; doar (re)delimitează blocuri întregi.
 */
export function mechanicalSanitize(statement: string): string {
  let s = statement;
  s = tabularToArray(s);
  // enunț = O SINGURĂ expresie LaTeX brută (fără $, fără proză/diacritice) →
  // o delimităm CA ÎNTREG cu $…$ (structural, ca delimitBareMath; nu schimbă math).
  const trimmed = s.trim();
  if (trimmed.startsWith("\\") && !trimmed.includes("$") && !/[ăâîșțĂÂÎȘȚ]/.test(trimmed)) {
    const withoutCmds = trimmed.replace(/\\[a-zA-Z]+/g, " ");
    if (!/[a-zA-Z]{6,}/.test(withoutCmds)) return `$${trimmed}$`;
  }
  // \[ \] și \( \) → delimitatori $ (echivalent de randare)
  s = s.replace(/\\\[/g, "$$$$").replace(/\\\]/g, "$$$$");
  s = s.replace(/\\\(/g, "$").replace(/\\\)/g, "$");
  // mediu de display ne-delimitat → înfășoară-l în $$…$$ (doar dacă nu e deja în math)
  const ENV = /\\begin\{(array|aligned|cases|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]*?\\end\{\1\}/g;
  s = s.replace(ENV, (block, _env, offset: number) => {
    // sări dacă blocul e deja între delimitatori $…$ / $$…$$
    const before = s.slice(0, offset);
    const dollars = (before.match(/\$/g) ?? []).length;
    if (dollars % 2 === 1) return block; // suntem în interiorul unui $…$
    return `$$${block}$$`;
  });
  return s;
}
