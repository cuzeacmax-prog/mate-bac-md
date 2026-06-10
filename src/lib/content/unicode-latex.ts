/**
 * unicode-latex.ts — ETAPA 70 G1: convertor DETERMINIST Unicode→LaTeX pentru
 * textele diagnosticului (generate istoric cu notație Unicode: x², √, ∫₀², x₁).
 *
 * Strategia: textul se sparge în spani de tokeni „matematici" consecutivi
 * (cuvintele românești ies natural — diacriticele nu sunt în clasa de
 * caractere); un span se convertește DOAR dacă are un marcaj matematic tare.
 * Înăuntrul spanului: înlocuiri pur deterministe → LaTeX între $...$.
 * Nimic generat — doar transliterare de notație (R5 intact).
 */

const SUP_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁻': '-', '⁺': '+', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ˣ': 'x', 'ᵒ': 'o', 'ᵖ': 'p', 'ᵇ': 'b',
};
const SUB_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', 'ₙ': 'n', 'ₖ': 'k',
};
const SUP_CLASS = Object.keys(SUP_MAP).join('');
const SUB_CLASS = Object.keys(SUB_MAP).join('');

/** simboluri singulare → comenzi LaTeX (aplicate în interiorul spanului) */
const SYMBOLS: Array<[RegExp, string]> = [
  [/ℝ/g, '\\mathbb{R}'], [/ℂ/g, '\\mathbb{C}'], [/ℤ/g, '\\mathbb{Z}'],
  [/∈/g, '\\in '], [/∉/g, '\\notin '],
  [/≤/g, '\\le '], [/≥/g, '\\ge '], [/≠/g, '\\neq '], [/≈/g, '\\approx '],
  [/∞/g, '\\infty '], [/∅/g, '\\varnothing '],
  [/∪/g, '\\cup '], [/∩/g, '\\cap '],
  [/⟹|⇒/g, '\\Rightarrow '], [/⟺/g, '\\Leftrightarrow '], [/→/g, '\\to '],
  [/π/g, '\\pi '], [/Δ/g, '\\Delta '], [/α/g, '\\alpha '], [/β/g, '\\beta '],
  [/θ/g, '\\theta '], [/φ/g, '\\varphi '], [/Σ|∑/g, '\\sum '],
  [/±/g, '\\pm '], [/∓/g, '\\mp '], [/·|×/g, '\\cdot '], [/÷/g, ':'],
  [/−|–/g, '-'],
];

/** caracterele care fac un span „sigur matematic" */
const STRONG_RE = new RegExp(
  `[=<>^_∫√∛${SUP_CLASS}${SUB_CLASS}]|ℝ|ℂ|ℤ|∈|∉|≤|≥|≠|≈|∞|∅|∪|∩|⟹|⟺|⇒|→|π|Δ|α|β|θ|φ|Σ|∑|±|∓|·|×|÷`
);

/** clasele de caractere permise într-un token matematic */
const MATH_TOKEN_RE = new RegExp(
  `^[A-Za-z0-9${SUP_CLASS}${SUB_CLASS}∫√∛=<>+*/^_(){}\\[\\]|,.:;!?ℝℂℤ∈∉≤≥≠≈∞∅∪∩⟹⟺⇒→πΔαβθφΣ∑±∓·×÷−–\\\\-]+$`
);
/** un token care e doar cuvânt alfabetic lung NU e matematic (ex: "Indicați") */
const WORD_RE = /^[A-Za-z]{3,}[,.:;!?]?$/;

function convertSpan(span: string): string {
  let s = span;
  // ÎNTÂI: acoladele literale (mulțimi) → escapate; abia apoi conversiile
  // emit acolade LaTeX care NU trebuie atinse
  s = s.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
  // diferența de mulțimi „ \ " înaintea unei mulțimi → \setminus
  s = s.replace(/\s\\\s+(?=\\\{)/g, ' \\setminus ');
  // ∫ cu limite Unicode: ∫₀² → \int_{0}^{2}
  s = s.replace(
    new RegExp(`∫([${SUB_CLASS}]+)([${SUP_CLASS}]+)`, 'g'),
    (_, sub: string, sup: string) =>
      `\\int_{${[...sub].map((c) => SUB_MAP[c]).join('')}}^{${[...sup].map((c) => SUP_MAP[c]).join('')}}`
  );
  s = s.replace(/∫/g, '\\int ');
  // radicali: √(expr) → \sqrt{expr}; ∛(expr) → \sqrt[3]{expr}; √x → \sqrt{x}
  s = s.replace(/√\(([^()]*)\)/g, '\\sqrt{$1}');
  s = s.replace(/∛\(([^()]*)\)/g, '\\sqrt[3]{$1}');
  s = s.replace(new RegExp(`√([A-Za-z0-9${SUP_CLASS}${SUB_CLASS}]+)`, 'g'), '\\sqrt{$1}');
  s = s.replace(new RegExp(`∛([A-Za-z0-9${SUP_CLASS}${SUB_CLASS}]+)`, 'g'), '\\sqrt[3]{$1}');
  // exponenți/indici Unicode (grupuri întregi)
  s = s.replace(new RegExp(`[${SUP_CLASS}]+`, 'g'), (m) => `^{${[...m].map((c) => SUP_MAP[c]).join('')}}`);
  s = s.replace(new RegExp(`[${SUB_CLASS}]+`, 'g'), (m) => `_{${[...m].map((c) => SUB_MAP[c]).join('')}}`);
  // simboluri
  for (const [re, repl] of SYMBOLS) s = s.replace(re, repl);
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Convertește un text mixt (română + notație Unicode) → română + $LaTeX$.
 * Întoarce și dacă au RĂMAS notații neconvertite (conversie parțială).
 */
export function unicodeToLatex(text: string): { out: string; full: boolean } {
  if (!text) return { out: text, full: true };
  const tokens = text.split(/(\s+)/); // păstrează separatorii
  const out: string[] = [];
  let span: string[] = [];

  const flush = () => {
    if (span.length === 0) return;
    const raw = span.join('');
    const core = raw.trim();
    // marcaj tare SAU expresie cu operator între simboluri scurte (3x + 5);
    // spanul trebuie să aibă măcar un operand (litera/cifra) — „=)" singur nu e math
    const strong = STRONG_RE.test(core) || /[0-9][+\-*/][0-9A-Za-z(]|[A-Za-z]\s*[+\-*/]\s*[0-9(]/.test(core);
    const hasOperand = /[A-Za-z0-9ℝℂℤπΔαβθφ∞∅]/.test(core);
    if (strong && hasOperand && core.length > 1) {
      // punctuația finală rămâne în afara $...$
      const m = core.match(/^([\s\S]*?)([,.:;!?]*)$/);
      const body = m?.[1] ?? core;
      const punct = m?.[2] ?? '';
      out.push(raw.replace(core, `$${convertSpan(body)}$${punct}`));
    } else {
      out.push(raw);
    }
    span = [];
  };

  for (const t of tokens) {
    if (/^\s+$/.test(t) || t === '') {
      if (span.length > 0) span.push(t);
      else out.push(t);
      continue;
    }
    const isMath = MATH_TOKEN_RE.test(t) && !WORD_RE.test(t);
    if (isMath) span.push(t);
    else {
      flush();
      out.push(t);
    }
  }
  flush();

  let result = out.join('');
  // $a$ $b$ alipite prin spațiu → un singur span e ok să rămână separat;
  // curățăm doar spanurile goale
  result = result.replace(/\$\s*\$/g, '');
  // au rămas notații Unicode în afara spanurilor convertite?
  const leftover = new RegExp(`[${SUP_CLASS}${SUB_CLASS}∫√∛]|ℝ|ℂ|ℤ|∈|≤|≥|≠|∞|∅|∪|∩|⟹|⟺|π|Δ|Σ`).test(
    result.replace(/\$[^$]*\$/g, '')
  );
  return { out: result, full: !leftover };
}
