/**
 * katex-macros.ts — ETAPA 74 B2: O SINGURĂ convenție de notație KaTeX,
 * partajată de MathText, MessageRenderer și scriptul de randare-audit
 * (auditul trebuie să randeze EXACT ce randează produsul).
 */
export const KATEX_MACROS: Record<string, string> = {
  "\\R": "\\mathbb{R}",
  "\\N": "\\mathbb{N}",
  "\\Z": "\\mathbb{Z}",
  "\\Q": "\\mathbb{Q}",
};

/**
 * KaTeX nu cunoaște mediul `tabular` (e LaTeX de paginare, nu math) —
 * îl traducem în `array`, pe care KaTeX îl randează nativ. Specificatorii
 * de coloană cu bare (|c|c|) sunt suportați de array.
 */
export function tabularToArray(latex: string): string {
  return latex
    .replace(/\\begin\{tabular\}/g, "\\begin{array}")
    .replace(/\\end\{tabular\}/g, "\\end{array}");
}
