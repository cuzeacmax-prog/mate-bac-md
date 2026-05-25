/**
 * latex-to-speech.ts
 * Convertește LaTeX/Markdown matematic → text rostibil în română.
 * Folosit pentru TTS (OpenAI TTS-1) ca semnele matematice să fie pronunțate corect.
 *
 * Exemple:
 *   $x^2$              → "x la pătrat"
 *   $\Delta = b^2-4ac$ → "delta egal cu b la pătrat minus patru a c"
 *   $S = \{2, 3\}$     → "S egal cu mulțimea doi virgulă trei"
 */

type ReplacerFn = (match: string, ...args: string[]) => string;
interface Rule { pattern: RegExp; replacement: string | ReplacerFn }

const RULES: Rule[] = [
  // ── Markeri blocuri (eliminate) ──────────────────────────────────
  { pattern: /\[\[BLOCK:[^\]]+\]\]/g, replacement: '' },
  { pattern: /\[\[\/BLOCK\]\]/g,       replacement: '' },

  // ── Delimitatori KaTeX (extrage conținut) ────────────────────────
  { pattern: /\$\$([^$]+)\$\$/g, replacement: ' $1 ' },
  { pattern: /\$([^$]+)\$/g,     replacement: ' $1 ' },

  // ── Exponenți ────────────────────────────────────────────────────
  { pattern: /\^2\b/g,            replacement: ' la pătrat ' },
  { pattern: /\^3\b/g,            replacement: ' la cub ' },
  { pattern: /\^\{(\d+)\}/g,      replacement: (_, n) => ` la puterea ${n} ` },
  { pattern: /\^\{([^}]+)\}/g,    replacement: (_, e) => ` la puterea ${e} ` },
  { pattern: /\^(\d)/g,           replacement: (_, n) => ` la puterea ${n} ` },

  // ── Indici ───────────────────────────────────────────────────────
  { pattern: /_\{1,2\}/g,         replacement: ' indice unu virgulă doi ' },
  { pattern: /_\{(\d+),(\d+)\}/g, replacement: (_, a, b) => ` indice ${a} virgulă ${b} ` },
  { pattern: /_\{(\d+)\}/g,       replacement: (_, n) => ` indice ${n} ` },
  { pattern: /_\{([^}]+)\}/g,     replacement: (_, s) => ` indice ${s} ` },
  { pattern: /_(\d)/g,            replacement: (_, n) => ` indice ${n} ` },

  // ── Fracții ──────────────────────────────────────────────────────
  { pattern: /\\frac\{([^}]+)\}\{([^}]+)\}/g, replacement: (_, n, d) => ` ${n} pe ${d} ` },

  // ── Radicali ─────────────────────────────────────────────────────
  { pattern: /\\sqrt\[(\d+)\]\{([^}]+)\}/g, replacement: (_, n, x) => ` radical de ordinul ${n} din ${x} ` },
  { pattern: /\\sqrt\{([^}]+)\}/g,           replacement: (_, x) => ` radical din ${x} ` },
  { pattern: /\\sqrt\b/g,                    replacement: ' radical ' },

  // ── Litere grecești ──────────────────────────────────────────────
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

  // ── Mulțimi ──────────────────────────────────────────────────────
  { pattern: /\\mathbb\{R\}/g, replacement: ' numere reale ' },
  { pattern: /\\mathbb\{N\}/g, replacement: ' numere naturale ' },
  { pattern: /\\mathbb\{Z\}/g, replacement: ' numere întregi ' },
  { pattern: /\\mathbb\{Q\}/g, replacement: ' numere raționale ' },
  { pattern: /\\mathbb\{C\}/g, replacement: ' numere complexe ' },
  { pattern: /\\in\b/g,        replacement: ' aparține lui ' },
  { pattern: /\\notin\b/g,     replacement: ' nu aparține lui ' },
  { pattern: /\\subset\b/g,    replacement: ' inclus în ' },
  { pattern: /\\cup\b/g,       replacement: ' reunit cu ' },
  { pattern: /\\cap\b/g,       replacement: ' intersectat cu ' },
  { pattern: /\\emptyset\b/g,  replacement: ' mulțimea vidă ' },
  { pattern: /\\varnothing\b/g,replacement: ' mulțimea vidă ' },
  // Acolade mulțime: \{...\}
  { pattern: /\\\{([^}]*)\\\}/g, replacement: (_, c) => ` mulțimea care conține ${c} ` },

  // ── Operatori relaționali ────────────────────────────────────────
  { pattern: /\\leq\b/g,     replacement: ' mai mic sau egal cu ' },
  { pattern: /\\geq\b/g,     replacement: ' mai mare sau egal cu ' },
  { pattern: /\\neq\b/g,     replacement: ' diferit de ' },
  { pattern: /\\approx\b/g,  replacement: ' aproximativ egal cu ' },
  { pattern: /\\equiv\b/g,   replacement: ' echivalent cu ' },
  { pattern: /\\iff\b/g,     replacement: ' dacă și numai dacă ' },
  { pattern: /⟺/g,           replacement: ' echivalent cu ' },
  { pattern: /⟹/g,           replacement: ' rezultă ' },
  { pattern: /⋃/g,           replacement: ' reuniune ' },

  // ── Operatori aritmetici ─────────────────────────────────────────
  { pattern: /\\cdot\b/g,    replacement: ' ori ' },
  { pattern: /\\times\b/g,   replacement: ' ori ' },
  { pattern: /\\div\b/g,     replacement: ' împărțit la ' },
  { pattern: /\\pm\b/g,      replacement: ' plus sau minus ' },
  { pattern: /\\mp\b/g,      replacement: ' minus sau plus ' },

  // ── Implicații și săgeți ─────────────────────────────────────────
  { pattern: /\\Leftrightarrow\b/g, replacement: ' echivalent cu ' },
  { pattern: /\\Rightarrow\b/g,     replacement: ' rezultă că ' },
  { pattern: /\\rightarrow\b/g,     replacement: ' tinde spre ' },
  { pattern: /\\leftarrow\b/g,      replacement: ' vine din ' },
  { pattern: /\\to\b/g,             replacement: ' tinde la ' },
  { pattern: /\\implies\b/g,        replacement: ' implică ' },
  { pattern: /\\iff\b/g,            replacement: ' dacă și numai dacă ' },

  // ── Funcții trigonometrice ────────────────────────────────────────
  { pattern: /\\sin\b/g,   replacement: ' sinus ' },
  { pattern: /\\cos\b/g,   replacement: ' cosinus ' },
  { pattern: /\\tan\b/g,   replacement: ' tangentă ' },
  { pattern: /\\cot\b/g,   replacement: ' cotangentă ' },
  { pattern: /\\arcsin\b/g,replacement: ' arcsin ' },
  { pattern: /\\arccos\b/g,replacement: ' arccos ' },
  { pattern: /\\arctan\b/g,replacement: ' arctangentă ' },

  // ── Funcții diverse ──────────────────────────────────────────────
  { pattern: /\\log_\{([^}]+)\}/g, replacement: (_, b) => ` logaritm în baza ${b} din ` },
  { pattern: /\\log\b/g,            replacement: ' logaritm ' },
  { pattern: /\\ln\b/g,             replacement: ' logaritm natural ' },
  { pattern: /\\lg\b/g,             replacement: ' logaritm zecimal ' },
  { pattern: /\\exp\b/g,            replacement: ' exponențiala ' },

  // ── Calcul integral și limite ────────────────────────────────────
  { pattern: /\\int_\{([^}]+)\}\^\{([^}]+)\}/g, replacement: (_, a, b) => ` integrală de la ${a} la ${b} ` },
  { pattern: /\\int\b/g,     replacement: ' integrală ' },
  { pattern: /\\sum\b/g,     replacement: ' sumă ' },
  { pattern: /\\prod\b/g,    replacement: ' produs ' },
  { pattern: /\\lim\b/g,     replacement: ' limita ' },
  { pattern: /\\infty\b/g,   replacement: ' infinit ' },
  { pattern: /\\partial\b/g, replacement: ' derivata parțială ' },

  // ── Logică matematică ────────────────────────────────────────────
  { pattern: /\\forall\b/g,  replacement: ' pentru orice ' },
  { pattern: /\\exists\b/g,  replacement: ' există ' },

  // ── Notație BAC MD specifică ─────────────────────────────────────
  { pattern: /\bDVA\b/g,     replacement: ' domeniul valorilor admisibile ' },
  { pattern: /\bS\s*=\s*\\\{/g, replacement: ' mulțimea soluțiilor S conține ' },
  { pattern: /\bR\s*:\s*/g,  replacement: ' Răspuns: ' },
  { pattern: /\bR\/S\s*:\s*/g, replacement: ' Răspuns: ' },

  // ── Markeri vizuali (elimina) ────────────────────────────────────
  { pattern: /📋/g,   replacement: '' },
  { pattern: /✦/g,   replacement: '' },
  { pattern: /✓/g,   replacement: '' },
  { pattern: /💡/g,   replacement: '' },
  { pattern: /⚠️?/g, replacement: '' },

  // ── Markdown ─────────────────────────────────────────────────────
  { pattern: /\*\*([^*]+)\*\*/g, replacement: '$1' },
  { pattern: /\*([^*]+)\*/g,     replacement: '$1' },
  { pattern: /^#+\s+/gm,         replacement: '' },
  { pattern: /\|/g,              replacement: ' ' },
  // Linkuri Markdown
  { pattern: /\[([^\]]+)\]\([^)]+\)/g, replacement: '$1' },

  // ── Fracții numerice în text plat ────────────────────────────────
  { pattern: /(\d+)\/(\d+)/g,    replacement: (_, n, d) => ` ${n} pe ${d} ` },

  // ── Semne aritmetice Unicode ─────────────────────────────────────
  { pattern: /≤/g,  replacement: ' mai mic sau egal cu ' },
  { pattern: /≥/g,  replacement: ' mai mare sau egal cu ' },
  { pattern: /≠/g,  replacement: ' diferit de ' },
  { pattern: /≈/g,  replacement: ' aproximativ ' },
  { pattern: /→/g,  replacement: ' tinde spre ' },
  { pattern: /←/g,  replacement: ' vine din ' },
  { pattern: /×/g,  replacement: ' ori ' },
  { pattern: /÷/g,  replacement: ' împărțit la ' },
  { pattern: /√/g,  replacement: ' radical ' },
  { pattern: /∞/g,  replacement: ' infinit ' },
  { pattern: /∈/g,  replacement: ' aparține ' },
  { pattern: /∉/g,  replacement: ' nu aparține ' },
  { pattern: /∪/g,  replacement: ' reuniune ' },
  { pattern: /∩/g,  replacement: ' intersecție ' },
  { pattern: /∅/g,  replacement: ' mulțimea vidă ' },

  // ── Curățire backslash-uri rămase ───────────────────────────────
  { pattern: /\\[a-zA-Z]+\b/g, replacement: ' ' },
  { pattern: /[\{\}]/g,        replacement: ' ' },

  // ── Normalizare spații ───────────────────────────────────────────
  { pattern: /[ \t]+/g,  replacement: ' ' },
  { pattern: /\n{3,}/g,  replacement: '\n\n' },
];

export function latexToSpeech(text: string): string {
  let result = text;
  for (const { pattern, replacement } of RULES) {
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement as (...args: string[]) => string);
    } else {
      result = result.replace(pattern, replacement);
    }
  }
  return result.trim().replace(/\s+/g, ' ');
}
