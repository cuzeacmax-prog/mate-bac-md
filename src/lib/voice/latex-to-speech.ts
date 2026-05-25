/**
 * latex-to-speech.ts — v2
 * Convertește LaTeX/Markdown matematic → text rostibil în română.
 *
 * Pipeline în 7 pași (ordinea contează):
 *   1. removeExplanatoryParens  — "DVA (Domeniu...)" → "DVA"
 *   2. stripKatexDelimiters     — $...$ → text cu pauze
 *   3. applyMathRules           — comenzi LaTeX → cuvinte românești
 *   4. expandFunctionNotation   — f(x) → "eff de iks"
 *   5. stripDecorations         — emoji, markdown, markeri block
 *   6. expandShortNotations     — R:, S={...}, fracții simple
 *   7. normalizeRhythm          — spații, punct final
 *
 * Exemple:
 *   f(x) = x^2           → "eff de iks, egal cu iks la pătrat."
 *   DVA (Dom. Valorilor…) → "DVA"
 *   $\Delta = b^2 - 4ac$  → "delta egal cu b la pătrat minus patru a c"
 *   S = \{2; 3\}          → "mulțimea soluțiilor este doi; trei"
 */

type ReplacerFn = (match: string, ...groups: string[]) => string;
interface Rule {
  pattern: RegExp;
  replacement: string | ReplacerFn;
}

// ══════════════════════════════════════════════════════════════════════
// PASUL 1 — Elimină explicații redundante din acronime
// "DVA (Domeniu Valorilor Admisibile)" → "DVA"
// "RAC (Relații și Calcule)"           → "RAC"
// ══════════════════════════════════════════════════════════════════════
function removeExplanatoryParens(text: string): string {
  // Acronim (≥2 litere mari) urmat de paranteză cu ≥12 caractere
  return text.replace(
    /\b([A-ZĂÂÎȘȚ]{2,}[A-ZĂÂÎȘȚ0-9]*)\s*\(([^)]{12,})\)/g,
    '$1'
  );
}

// ══════════════════════════════════════════════════════════════════════
// PASUL 2 — Extrage conținut din delimitatori KaTeX, adaugă pauze
// $$...$$ → ", ..., "   (formulă de bloc cu pauze mai lungi)
// $...$   → " ... "     (formulă inline)
// ══════════════════════════════════════════════════════════════════════
function stripKatexDelimiters(text: string): string {
  // Block formulas first (longer pause context)
  let result = text.replace(/\$\$([^$]+)\$\$/g, (_, inner) => `, ${inner.trim()}, `);
  // Inline formulas
  result = result.replace(/\$([^$\n]{1,200})\$/g, (_, inner) => ` ${inner.trim()} `);
  return result;
}

// ══════════════════════════════════════════════════════════════════════
// PASUL 3 — Operatori matematici LaTeX → cuvinte românești
// ══════════════════════════════════════════════════════════════════════
const MATH_RULES: Rule[] = [
  // ── Exponenți ──────────────────────────────────────────────────────
  { pattern: /\^2\b/g,               replacement: ' la pătrat' },
  { pattern: /\^3\b/g,               replacement: ' la cub' },
  { pattern: /\^\{(\d+)\}/g,         replacement: (_, n) => ` la puterea ${n}` },
  { pattern: /\^\{([^}]+)\}/g,       replacement: (_, e) => ` la puterea ${e}` },
  { pattern: /\^(\d)/g,              replacement: (_, n) => ` la puterea ${n}` },

  // ── Indici ─────────────────────────────────────────────────────────
  { pattern: /_\{1,2\}/g,            replacement: ' unu virgulă doi' },
  { pattern: /_\{(\d+),(\d+)\}/g,    replacement: (_, a, b) => ` ${a} virgulă ${b}` },
  { pattern: /_\{(\d+)\}/g,          replacement: (_, n) => ` indice ${n}` },
  { pattern: /_\{([^}]+)\}/g,        replacement: (_, s) => ` indice ${s}` },
  { pattern: /_(\d)/g,               replacement: (_, n) => ` indice ${n}` },

  // ── Fracții ────────────────────────────────────────────────────────
  { pattern: /\\frac\{([^}]+)\}\{([^}]+)\}/g,
    replacement: (_, n, d) => ` ${n} pe ${d} ` },

  // ── Radicali ───────────────────────────────────────────────────────
  { pattern: /\\sqrt\[(\d+)\]\{([^}]+)\}/g,
    replacement: (_, n, x) => ` radical de ordinul ${n} din ${x} ` },
  { pattern: /\\sqrt\{([^}]+)\}/g,   replacement: (_, x) => ` radical din ${x} ` },
  { pattern: /\\sqrt\b/g,            replacement: ' radical din ' },

  // ── Litere grecești ────────────────────────────────────────────────
  { pattern: /\\Delta\b/g,   replacement: ' delta ' },
  { pattern: /\\alpha\b/g,   replacement: ' alfa ' },
  { pattern: /\\beta\b/g,    replacement: ' beta ' },
  { pattern: /\\gamma\b/g,   replacement: ' gama ' },
  { pattern: /\\delta\b/g,   replacement: ' delta ' },
  { pattern: /\\pi\b/g,      replacement: ' pi ' },
  { pattern: /\\theta\b/g,   replacement: ' teta ' },
  { pattern: /\\lambda\b/g,  replacement: ' lambda ' },
  { pattern: /\\mu\b/g,      replacement: ' miu ' },
  { pattern: /\\phi\b/g,     replacement: ' fi ' },
  { pattern: /\\omega\b/g,   replacement: ' omega ' },
  { pattern: /\\sigma\b/g,   replacement: ' sigma ' },
  { pattern: /\\epsilon\b/g, replacement: ' epsilon ' },
  { pattern: /\\rho\b/g,     replacement: ' ro ' },
  { pattern: /\\tau\b/g,     replacement: ' tau ' },
  { pattern: /\\psi\b/g,     replacement: ' psi ' },
  { pattern: /\\chi\b/g,     replacement: ' hi ' },
  { pattern: /\\xi\b/g,      replacement: ' xi ' },
  { pattern: /\\eta\b/g,     replacement: ' eta ' },
  { pattern: /\\kappa\b/g,   replacement: ' kapa ' },
  { pattern: /\\nu\b/g,      replacement: ' ni ' },

  // ── Mulțimi ────────────────────────────────────────────────────────
  { pattern: /\\mathbb\{R\}/g, replacement: ' mulțimea numerelor reale ' },
  { pattern: /\\mathbb\{N\}/g, replacement: ' mulțimea numerelor naturale ' },
  { pattern: /\\mathbb\{Z\}/g, replacement: ' mulțimea numerelor întregi ' },
  { pattern: /\\mathbb\{Q\}/g, replacement: ' mulțimea numerelor raționale ' },
  { pattern: /\\mathbb\{C\}/g, replacement: ' mulțimea numerelor complexe ' },
  { pattern: /\\in\b/g,        replacement: ' aparține lui ' },
  { pattern: /\\notin\b/g,     replacement: ' nu aparține lui ' },
  { pattern: /\\subset\b/g,    replacement: ' inclus în ' },
  { pattern: /\\subseteq\b/g,  replacement: ' inclus sau egal cu ' },
  { pattern: /\\cup\b/g,       replacement: ' reunit cu ' },
  { pattern: /\\cap\b/g,       replacement: ' intersectat cu ' },
  { pattern: /\\emptyset\b/g,  replacement: ' mulțimea vidă ' },
  { pattern: /\\varnothing\b/g,replacement: ' mulțimea vidă ' },
  // Acolade mulțime: \{...\}
  { pattern: /\\\{([^}]*)\\\}/g, replacement: (_, c) => ` mulțimea care conține ${c} ` },

  // ── Operatori relaționali ──────────────────────────────────────────
  { pattern: /\\leq\b/g,     replacement: ' mai mic sau egal cu ' },
  { pattern: /\\geq\b/g,     replacement: ' mai mare sau egal cu ' },
  { pattern: /\\neq\b/g,     replacement: ' diferit de ' },
  { pattern: /\\approx\b/g,  replacement: ' aproximativ egal cu ' },
  { pattern: /\\equiv\b/g,   replacement: ' echivalent cu ' },
  { pattern: /\\iff\b/g,     replacement: ' dacă și numai dacă ' },
  { pattern: /\\sim\b/g,     replacement: ' similar cu ' },

  // Unicode logic / arrows
  { pattern: /⟺/g,  replacement: ' echivalent cu ' },
  { pattern: /⟹/g,  replacement: ' rezultă că ' },
  { pattern: /⟸/g,  replacement: ' dacă ' },
  { pattern: /⋃/g,  replacement: ' reuniunea ' },
  { pattern: /⋂/g,  replacement: ' intersecția ' },

  // ── Operatori aritmetici ───────────────────────────────────────────
  { pattern: /\\cdot\b/g,    replacement: ' ori ' },
  { pattern: /\\times\b/g,   replacement: ' ori ' },
  { pattern: /\\div\b/g,     replacement: ' împărțit la ' },
  { pattern: /\\pm\b/g,      replacement: ' plus sau minus ' },
  { pattern: /\\mp\b/g,      replacement: ' minus sau plus ' },

  // ── Implicații și săgeți ──────────────────────────────────────────
  { pattern: /\\Leftrightarrow\b/g, replacement: ' echivalent cu ' },
  { pattern: /\\Rightarrow\b/g,     replacement: ' rezultă că ' },
  { pattern: /\\Leftarrow\b/g,      replacement: ' dacă ' },
  { pattern: /\\rightarrow\b/g,     replacement: ' tinde spre ' },
  { pattern: /\\leftarrow\b/g,      replacement: ' vine din ' },
  { pattern: /\\to\b/g,             replacement: ' tinde la ' },
  { pattern: /\\implies\b/g,        replacement: ' implică ' },

  // ── Funcții trigonometrice ────────────────────────────────────────
  { pattern: /\\sin\b/g,    replacement: ' sinus ' },
  { pattern: /\\cos\b/g,    replacement: ' cosinus ' },
  { pattern: /\\tan\b/g,    replacement: ' tangentă ' },
  { pattern: /\\tg\b/g,     replacement: ' tangentă ' },
  { pattern: /\\cot\b/g,    replacement: ' cotangentă ' },
  { pattern: /\\ctg\b/g,    replacement: ' cotangentă ' },
  { pattern: /\\arcsin\b/g, replacement: ' arcsin ' },
  { pattern: /\\arccos\b/g, replacement: ' arccos ' },
  { pattern: /\\arctan\b/g, replacement: ' arctangentă ' },

  // ── Funcții diverse ───────────────────────────────────────────────
  { pattern: /\\log_\{([^}]+)\}/g, replacement: (_, b) => ` logaritm în baza ${b} din ` },
  { pattern: /\\log\b/g,   replacement: ' logaritm ' },
  { pattern: /\\ln\b/g,    replacement: ' logaritm natural ' },
  { pattern: /\\lg\b/g,    replacement: ' logaritm zecimal ' },
  { pattern: /\\exp\b/g,   replacement: ' exponențiala ' },
  { pattern: /\\max\b/g,   replacement: ' maximul ' },
  { pattern: /\\min\b/g,   replacement: ' minimul ' },
  { pattern: /\\gcd\b/g,   replacement: ' cel mai mare divizor comun din ' },

  // ── Calcul integral și limite ─────────────────────────────────────
  { pattern: /\\int_\{([^}]+)\}\^\{([^}]+)\}/g,
    replacement: (_, a, b) => ` integrala de la ${a} la ${b} din ` },
  { pattern: /\\int\b/g,     replacement: ' integrala ' },
  { pattern: /\\sum\b/g,     replacement: ' suma ' },
  { pattern: /\\prod\b/g,    replacement: ' produsul ' },
  { pattern: /\\lim\b/g,     replacement: ' limita ' },
  { pattern: /\\infty\b/g,   replacement: ' infinit ' },
  { pattern: /\\partial\b/g, replacement: ' derivata parțială ' },
  { pattern: /\\mathrm\{d\}/g, replacement: 'd' },
  { pattern: /\\,\s*d([a-z])/g, replacement: (_, v) => ` d${v}` },

  // ── Logică ────────────────────────────────────────────────────────
  { pattern: /\\forall\b/g,  replacement: ' pentru orice ' },
  { pattern: /\\exists\b/g,  replacement: ' există ' },
  { pattern: /\\neg\b/g,     replacement: ' nu ' },
  { pattern: /\\land\b/g,    replacement: ' și ' },
  { pattern: /\\lor\b/g,     replacement: ' sau ' },

  // ── Simboluri de tabel de variație ───────────────────────────────
  { pattern: /\\searrow\b/g, replacement: ' descrescătoare ' },
  { pattern: /\\nearrow\b/g, replacement: ' crescătoare ' },
  { pattern: /\\swarrow\b/g, replacement: ' descrescătoare ' },
  { pattern: /\\nwarrow\b/g, replacement: ' crescătoare ' },

  // ── Spații LaTeX ──────────────────────────────────────────────────
  { pattern: /\\quad\b/g,  replacement: ' ' },
  { pattern: /\\qquad\b/g, replacement: ' ' },
  { pattern: /\\,/g,       replacement: ' ' },
  { pattern: /\\;/g,       replacement: ' ' },
  { pattern: /\\:/g,       replacement: ' ' },
  { pattern: /\\!/g,       replacement: '' },
  { pattern: /\\text\{([^}]+)\}/g, replacement: (_, t) => ` ${t} ` },

  // ── Semne Unicode aritmetice ──────────────────────────────────────
  { pattern: /≤/g, replacement: ' mai mic sau egal cu ' },
  { pattern: /≥/g, replacement: ' mai mare sau egal cu ' },
  { pattern: /≠/g, replacement: ' diferit de ' },
  { pattern: /≈/g, replacement: ' aproximativ ' },
  { pattern: /→/g, replacement: ' tinde spre ' },
  { pattern: /←/g, replacement: ' vine din ' },
  { pattern: /↔/g, replacement: ' echivalent cu ' },
  { pattern: /×/g, replacement: ' ori ' },
  { pattern: /÷/g, replacement: ' împărțit la ' },
  { pattern: /√/g, replacement: ' radical din ' },
  { pattern: /∞/g, replacement: ' infinit ' },
  { pattern: /∈/g, replacement: ' aparține ' },
  { pattern: /∉/g, replacement: ' nu aparține ' },
  { pattern: /∪/g, replacement: ' reuniunea cu ' },
  { pattern: /∩/g, replacement: ' intersecția cu ' },
  { pattern: /∅/g, replacement: ' mulțimea vidă ' },
  { pattern: /±/g, replacement: ' plus sau minus ' },

  // ── Curățire finală LaTeX ─────────────────────────────────────────
  { pattern: /\\dfrac\{([^}]+)\}\{([^}]+)\}/g, replacement: (_, n, d) => ` ${n} pe ${d} ` },
  { pattern: /\\tfrac\{([^}]+)\}\{([^}]+)\}/g, replacement: (_, n, d) => ` ${n} pe ${d} ` },
  { pattern: /\\[a-zA-Z]+\b/g, replacement: ' ' },
  { pattern: /[\{\}]/g,        replacement: ' ' },
  { pattern: /\[/g,            replacement: ' ' },
  { pattern: /\]/g,            replacement: ' ' },
];

function applyMathRules(text: string): string {
  let result = text;
  for (const { pattern, replacement } of MATH_RULES) {
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement as ReplacerFn);
    } else {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════
// PASUL 4 — Expandează notația funcțională f(x), g(t), h'(x), etc.
// f(x)   → "eff de iks"
// f'(x)  → "eff prim de iks"
// g(2x)  → "ge de doi iks"
// ══════════════════════════════════════════════════════════════════════
const LETTER_NAMES: Record<string, string> = {
  a: 'a', b: 'be', c: 'ce', d: 'de', e: 'e', f: 'eff',
  g: 'ge', h: 'ha', i: 'i', j: 'jei', k: 'ca', l: 'el',
  m: 'em', n: 'en', o: 'o', p: 'pe', q: 'cu', r: 'er',
  s: 'es', t: 'te', u: 'u', v: 've', w: 'dublu-ve',
  x: 'iks', y: 'igrec', z: 'zet',
};

function expandFunctionNotation(text: string): string {
  // Potrivire: literă mică + apostroafe opționale + paranteză cu cel mult 15 caractere
  return text.replace(
    /\b([a-z])('*)\s*\(([^)]{1,15})\)/g,
    (_match: string, fn: string, primes: string, arg: string): string => {
      const fnName = LETTER_NAMES[fn] ?? fn;
      // Expandează literele din argument
      const argExpanded = arg.replace(
        /\b([a-z])\b/g,
        (_m: string, l: string): string => LETTER_NAMES[l] ?? l
      );
      const primesStr = primes ? ' prim'.repeat(primes.length) : '';
      return `${fnName}${primesStr} de ${argExpanded}`;
    }
  );
}

// ══════════════════════════════════════════════════════════════════════
// PASUL 5 — Elimină decorații vizuale (emoji, markdown, block markers)
// ══════════════════════════════════════════════════════════════════════
function stripDecorations(text: string): string {
  let result = text;

  // Block markers [[BLOCK:...]] și [[/BLOCK]]
  result = result.replace(/\[\[BLOCK:[^\]]+\]\]/g, '');
  result = result.replace(/\[\[\/BLOCK\]\]/g, '');

  // Emoji Unicode (plan emoji: U+1F300-U+1FFFF + diverse simboluri)
  result = result.replace(/[\u{1F300}-\u{1FFFF}]/gu, '');
  // Emoji frecvente în prompt
  result = result.replace(/[📋✦✓💡⚠️🎯📍💬🔴🟡🟢⭐]/g, '');

  // Blocuri de cod
  result = result.replace(/```[\s\S]*?```/g, '');
  result = result.replace(/`([^`\n]+)`/g, '$1');

  // Markdown bold/italic
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/\*([^*\n]+)\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  result = result.replace(/_([^_\n]+)_/g, '$1');

  // Heading-uri Markdown
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Pipe-uri (tabele)
  result = result.replace(/\|/g, ' ');

  // Linkuri Markdown [text](url)
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Linie orizontală ---
  result = result.replace(/^[-*_]{3,}\s*$/gm, '');

  // Backslash-uri rămase izolate
  result = result.replace(/\\/g, ' ');

  return result;
}

// ══════════════════════════════════════════════════════════════════════
// PASUL 6 — Expandează notații scurte specifice BAC MD
// ══════════════════════════════════════════════════════════════════════
function expandShortNotations(text: string): string {
  let result = text;

  // R/S: → Răspuns:
  result = result.replace(/\bR\/S\s*:/g, 'Răspuns:');
  // R: → Răspuns: (dar nu în "Rezultat:", "Referință:", etc.)
  result = result.replace(/\bR\s*(?=\s*S\s*=|\s*\{|\s*$)/gm, 'Răspuns');
  result = result.replace(/^R\s*:/gm, 'Răspuns:');

  // S = {...} (mulțimea soluțiilor) — fără backslash-uri (deja curățate)
  result = result.replace(
    /\bS\s*=\s*\{([^}]+)\}/g,
    (_: string, c: string) => `mulțimea soluțiilor este ${c}`
  );

  // DVA — lasă acronimul (e familiar pentru elevi)
  // Intervalele (a; b), [a; b) — lasă naturale pentru TTS

  // Fracții numerice în text plat: 3/4 → "trei pe patru"
  result = result.replace(
    /(\d+)\/(\d+)/g,
    (_: string, n: string, d: string) => `${n} pe ${d}`
  );

  return result;
}

// ══════════════════════════════════════════════════════════════════════
// PASUL 7 — Normalizare ritm, spații, punct final
// ══════════════════════════════════════════════════════════════════════
function normalizeRhythm(text: string): string {
  let result = text;

  // Spații multiple → un spațiu
  result = result.replace(/[ \t]+/g, ' ');

  // Linii goale multiple → max 2
  result = result.replace(/\n{3,}/g, '\n\n');

  // Punct final dacă textul nu se termină cu semn de punctuație
  result = result.trim();
  if (result.length > 0 && !/[.!?…]$/.test(result)) {
    result += '.';
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════════
// EXPORT — funcția principală
// ══════════════════════════════════════════════════════════════════════

/**
 * Convertește text matematic (LaTeX/Markdown) în text natural rostibil.
 * Aplică pipeline în 7 pași.
 * @param text Text brut din răspunsul AI (poate conține LaTeX, Markdown, emoji)
 * @returns Text curat, românesc, gata pentru TTS
 */
export function latexToSpeech(text: string): string {
  let result = text;
  result = removeExplanatoryParens(result);  // 1. DVA (Domeniu...) → DVA
  result = stripKatexDelimiters(result);     // 2. $...$ → text cu pauze
  result = applyMathRules(result);           // 3. LaTeX → cuvinte românești
  result = expandFunctionNotation(result);   // 4. f(x) → "eff de iks"
  result = stripDecorations(result);         // 5. emoji, markdown, block markers
  result = expandShortNotations(result);     // 6. R:, S={...}, fracții
  result = normalizeRhythm(result);          // 7. spații, punct final
  return result;
}
