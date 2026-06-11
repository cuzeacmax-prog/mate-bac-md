/**
 * content-math.ts — segmentează proză română cu LaTeX inline în bucăți TEXT vs MATH.
 * Pur (fără React, fără DOM) — folosit de panoul de revizuire ȘI de scriptul de raport KaTeX.
 *
 * Strategie conservatoare ("randează DOAR ce e clar math"):
 *  1. Delimitatori expliciți: $$...$$, \[...\] (display); $...$, \(...\) (inline).
 *  2. În rest, runuri care PORNESC dintr-o comandă LaTeX (\\cmd) și se întind peste unități math
 *     (argumente {..}, ^/_, numere, variabile-litere izolate, operatori, comenzi de spațiere).
 *     Un cuvânt de proză (≥2 litere consecutive) OPREȘTE runul. Restul rămâne text.
 */

export interface MathSegment {
  type: "text" | "math";
  value: string;
  display: boolean; // doar pentru type==='math'
  /** textul original cu delimitatori (fallback „text brut" la LaTeX invalid) */
  raw?: string;
}

// ATENȚIE: ch poate fi undefined (past sfârșit). /[A-Za-z]/.test(undefined) ar fi TRUE
// (coerce → "undefined"), deci buclă infinită. Verificăm exact UN caracter literă.
const isLetter = (ch: string | undefined): boolean => ch !== undefined && ch.length === 1 && /[A-Za-z]/.test(ch);

/** Consumă un run de math care începe la `start` (pe un '\'). Întoarce indexul de sfârșit. */
function consumeMathRun(s: string, start: number): number {
  let i = start;
  const consumeArgs = () => {
    // ^ _ cu argument {..} sau un singur caracter; și grupuri {..}
    for (;;) {
      const before = i;
      if (s[i] === "^" || s[i] === "_") {
        i++;
        if (s[i] === "{") { i = matchBrace(s, i); }
        else if (i < s.length) { i++; }
      } else if (s[i] === "{") {
        i = matchBrace(s, i);
      } else break;
      if (i <= before) break; // gardă anti-stagnare
    }
  };
  let progressed = false;
  for (;;) {
    const ch = s[i];
    if (ch === undefined) break;
    const before = i;
    if (ch === "\\" && isLetter(s[i + 1])) {           // \comanda
      const cmdStart = i + 1;
      i++; while (isLetter(s[i])) i++;
      const cmd = s.slice(cmdStart, i);
      if (cmd === "begin") {                            // mediu \begin{env}...\end{env} = atomic
        if (s[i] === "{") i = matchBrace(s, i);
        const endIdx = s.indexOf("\\end", i);
        if (endIdx !== -1) { i = endIdx + 4; if (s[i] === "{") i = matchBrace(s, i); }
        else i = s.length;
      } else {
        consumeArgs();
      }
      progressed = true;
    } else if (ch === "\\" && /[,;:!{}|\\ ]/.test(s[i + 1] ?? "")) { // \, \; \{ \| \\ etc.
      i += 2; progressed = true;
    } else if (ch === "{") {
      i = matchBrace(s, i); consumeArgs(); progressed = true;
    } else if (/[0-9]/.test(ch)) {
      while (/[0-9.,]/.test(s[i] ?? "")) i++; consumeArgs(); progressed = true;
    } else if (isLetter(ch) && !isLetter(s[i + 1] ?? "")) { // variabilă o singură literă
      i++; consumeArgs(); progressed = true;
    } else if ("=+-*/<>|()[],;&".includes(ch)) { // , ; & ca să nu rupem \left(a,b\right) / cases / matrici
      i++; progressed = true;
    } else if (ch === " " || ch === "\t" || ch === "\n") {
      // include spațiul DOAR dacă urmează (după spații) o unitate math
      let k = i; while (s[k] === " " || s[k] === "\t" || s[k] === "\n") k++;
      const n = s[k];
      const nextIsMath = n !== undefined && (
        (n === "\\" && (isLetter(s[k + 1]) || /[,;:!{|\\]/.test(s[k + 1] ?? ""))) ||
        n === "{" || /[0-9=+\-*/<>|(),;&]/.test(n) || (isLetter(n) && !isLetter(s[k + 1] ?? ""))
      );
      if (nextIsMath) { i = k; } else break;
    } else break;
    if (i <= before) break; // gardă: nicio iterație nu trebuie să stagneze
  }
  return progressed ? i : start;
}

function matchBrace(s: string, openIdx: number): number {
  let depth = 0, i = openIdx;
  for (; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") { depth--; if (depth === 0) return i + 1; }
  }
  return s.length;
}

function segmentPlain(text: string): MathSegment[] {
  const out: MathSegment[] = [];
  let i = 0, textStart = 0;
  const flushText = (end: number) => { if (end > textStart) out.push({ type: "text", value: text.slice(textStart, end), display: false }); };
  let guard = 0;
  while (i < text.length) {
    if (++guard > text.length * 4 + 100) break; // plasă de siguranță (gardele interne previn deja bucla)
    if (text[i] === "\\" && isLetter(text[i + 1])) {
      const end = consumeMathRun(text, i);
      if (end > i) {
        flushText(i);
        out.push({ type: "math", value: text.slice(i, end).trim(), display: false });
        i = textStart = end;
        continue;
      }
    }
    i++;
  }
  flushText(text.length);
  return out;
}

/**
 * ETAPA 72 P3a → ETAPA 74 B2: o „formulă" suspectă e aproape sigur TEXT
 * ÎNGHIȚIT de delimitatori nebalansați. Heuristica veche (peste 200 de
 * caractere SAU orice diacritice) avea FALSE POSITIVES de clasă, dovedite de
 * randare-audit: formulele display cu \text{dacă...} (diacritice LEGITIME) și
 * mediile array/tabular lungi cădeau pe text brut → scurgeri \begin{ / \hline
 * / $$ în ecran. Acum:
 *  - diacriticele contează DOAR în afara grupurilor \text{...};
 *  - lungimea contează doar fără mediu \begin{...} și cu densitate mică de
 *    comenzi (proza înghițită n-are comenzi; matematica reală are multe).
 */
const SUSPECT_MATH_LEN = 200;
const RO_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;
const TEXT_GROUP_RE = /\\(?:text|textbf|textit|textrm|mbox|operatorname)\s*\{[^{}]*\}/g;
export function isSuspectMath(value: string): boolean {
  // diacriticele din \text{...} sunt proză LEGITIMĂ în math — nu suspecte
  if (RO_DIACRITICS.test(value.replace(TEXT_GROUP_RE, ''))) return true;
  if (value.length <= SUSPECT_MATH_LEN) return false;
  // mediile (array/cases/aligned/tabular) sunt structură math, oricât de lungi
  if (/\\begin\{/.test(value)) return false;
  // proza înghițită are densitate mică de comenzi; formulele lungi reale, mare
  const commands = (value.match(/\\[a-zA-Z]+/g) ?? []).length;
  return commands < value.length / 60;
}

/**
 * ETAPA 74 B2: delimitatorii expliciti + mediile \begin{env}...\end{env}
 * NEDELIMITATE (clasa dovedită de randare-audit: enunțuri din culegere cu
 * array/tabular direct în text). Grupuri:
 *  1=$$..$$  2=\[..\]  3=numele mediului bare  4=$..$  5=\(..\)
 */
const DELIM_RE_SRC =
  "\\$\\$([\\s\\S]+?)\\$\\$|\\\\\\[([\\s\\S]+?)\\\\\\]|\\\\begin\\{([a-zA-Z*]+)\\}[\\s\\S]*?\\\\end\\{\\3\\}|\\$([^$\\n]+?)\\$|\\\\\\(([\\s\\S]+?)\\\\\\)";

/** valorile + display-ul unui match al DELIM_RE_SRC */
function delimMatch(m: RegExpExecArray): { val: string; display: boolean } {
  if (m[3] != null) return { val: m[0].trim(), display: true }; // mediul bare, întreg
  const display = m[1] != null || m[2] != null;
  return { val: (m[1] ?? m[2] ?? m[4] ?? m[5] ?? "").trim(), display };
}

/**
 * Segmentează STRICT pe delimitatori expliciți ($$...$$, \[...\], $...$, \(...\))
 * + medii \begin{...}...\end{...} de sine stătătoare (ETAPA 74 B2).
 * Pentru afișările către elev (ETAPA 62): doar matematica delimitată se randează,
 * textul românesc (și orice alt LaTeX nedelimitat) rămâne text brut.
 * ETAPA 72 P3a (defensiv): match-ul suspect (text înghițit) → TEXT BRUT.
 */
export function segmentDelimitedMath(text: string): MathSegment[] {
  if (!text) return [];
  const out: MathSegment[] = [];
  const re = new RegExp(DELIM_RE_SRC, "g");
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index), display: false });
    const { val, display } = delimMatch(m);
    if (isSuspectMath(val)) {
      // delimitatori nebalansați au înghițit proză — nu extindem formula
      out.push({ type: "text", value: m[0], display: false });
    } else {
      out.push({ type: "math", value: val, display, raw: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last), display: false });
  return out;
}

/**
 * ETAPA 72 P3c: taie un text la ~max caractere FĂRĂ să rupă o formulă —
 * tăietura cade întotdeauna pe o graniță de segment text (în afara
 * delimitatorilor). Sursa bug-ului „formula înghite textul": slice(0, 600)
 * reteza teoria în mijlocul unui $$...$$.
 */
export function truncateOutsideMath(text: string, max: number): string {
  if (text.length <= max) return text;
  const segments = segmentDelimitedMath(text);
  // formula care încalecă limita se include ÎNTREAGĂ (cu toleranță),
  // nu se taie pe jumătate și nici nu se pierde
  const MATH_OVERFLOW = 400;
  let out = '';
  for (const seg of segments) {
    const piece = seg.type === 'math' ? (seg.raw ?? `$${seg.value}$`) : seg.value;
    if (out.length + piece.length > max) {
      if (seg.type === 'text') {
        // putem tăia ÎN INTERIORUL textului, niciodată în math
        const room = max - out.length;
        if (room > 0) out += piece.slice(0, room);
      } else if (out.length + piece.length <= max + MATH_OVERFLOW) {
        out += piece; // formula întreagă, cu toleranță
      }
      break;
    }
    out += piece;
  }
  return out;
}

/** Segmentează un text (proză) în bucăți text/math. */
export function segmentMath(text: string): MathSegment[] {
  if (!text) return [];
  const out: MathSegment[] = [];
  // Delimitatori expliciți (+ medii bare, ETAPA 74 B2) întâi.
  const re = new RegExp(DELIM_RE_SRC, "g");
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(...segmentPlain(text.slice(last, m.index)));
    const { val, display } = delimMatch(m);
    out.push({ type: "math", value: val, display });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...segmentPlain(text.slice(last)));
  return out;
}
