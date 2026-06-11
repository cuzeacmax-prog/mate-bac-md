/**
 * difficulty.ts — ETAPA 75 FAZA C1: clasificatorul DETERMINIST de dificultate
 * (zero LLM). Rutează mesajul de chat: simple → Haiku, hard → Sonnet —
 * INDIFERENT de tier (aprobat: free poate primi Sonnet pe hard, în limita
 * bugetului lunar; gardurile din ETAPA 66 rămân arbitrul).
 *
 * PRAGURILE (documentate aici, nu magice; calibrate pe setul etichetat din
 * scripts/verify/etapa75-routing-acceptance.ts — 10/10 cerut):
 *  - scor ≥ 3 → hard; altfel simple.
 * SEMNALELE ȘI PONDERILE:
 *  +3 markeri de demonstrație („demonstrați", „arătați că", „justificați")
 *     — demonstrația singură e clasa cea mai grea → hard direct;
 *  +2 multi-cerință: ≥2 sub-itemi a)/b)/i)/ii), SAU ≥2 întrebări, SAU ≥2
 *     verbe-cerință (calculați… apoi determinați…) — exercițiu compus;
 *  +2 operatori de ANALIZĂ (integrală/primitivă, limită, derivată) — calculul
 *     în sine cere lanț de pași;
 *  +1 operatori de algebră/discret (combinatorică, complexe, log/exp ca
 *     ecuație, progresii) și geometrie în spațiu — max +2 cumulat cu analiza;
 *  +1 enunț lung (> 280 caractere) — structură de problemă, nu întrebare;
 *  +1 conceptul ancorat e de clasa a 12-a (prefixul slug-ului g12-).
 */

export type Difficulty = 'simple' | 'hard';

export interface DifficultyVerdict {
  level: Difficulty;
  score: number;
  signals: {
    proof: boolean;
    multiPart: boolean;
    advancedOpClasses: number;
    longStatement: boolean;
    grade12Anchor: boolean;
  };
}

const PROOF_RE = /demonstra[țt]i|ar[ăa]ta[țt]i\s+c[ăa]|justifica[țt]i|deduce[țt]i\s+c[ăa]/i;
const SUBITEM_RE = /(^|\s)[a-f]\)|(^|\s)(i{1,3}|iv|v)\)/gm;
const REQUEST_VERB_RE = /calcula[țt]i|determina[țt]i|afla[țt]i|rezolva[țt]i|studia[țt]i|stabili[țt]i/gi;
/** operatorii de ANALIZĂ — calculul în sine cere lanț de pași (+2) */
const CALC_OP_CLASSES: RegExp[] = [
  /\\int|integral|primitiv/i,
  /\\lim|limit[ăa]\s+(c[âa]nd|la|de)/i,
  /derivat|\\frac\{d/i,
];
/** algebră/discret/geometrie în spațiu — grele în combinație (+1 per clasă) */
const ALGEBRA_OP_CLASSES: RegExp[] = [
  /C_\{?\d|A_\{?\d|combin[ăa]ri|aranjamente|permut[ăa]ri/i,
  /num[ăa]r\s+complex|\bz\s*=\s*a\s*\+\s*b?i\b|\\bar\{z\}/i,
  /\\log|\\lg|\\ln|ecua[țt]ie\s+(logaritmic|exponen[țt]ial)/i,
  /progresie|\\sum|sum[ăa]\s+primilor/i,
  /piramid|prism[ăa]|trunchi|\bcon\b|cilindr|sfer[ăa]|tetraedr|unghi\s+diedru/i,
];
const LONG_STATEMENT_CHARS = 280;
export const HARD_THRESHOLD = 3;

export function classifyDifficulty(message: string, conceptSlug?: string | null): DifficultyVerdict {
  const proof = PROOF_RE.test(message);
  const subitems = message.match(SUBITEM_RE)?.length ?? 0;
  const questionMarks = (message.match(/\?/g) ?? []).length;
  const requestVerbs = message.match(REQUEST_VERB_RE)?.length ?? 0;
  const multiPart = subitems >= 2 || questionMarks >= 2 || requestVerbs >= 2;
  const calcOps = CALC_OP_CLASSES.filter((re) => re.test(message)).length;
  const algebraOps = ALGEBRA_OP_CLASSES.filter((re) => re.test(message)).length;
  const advancedOpClasses = calcOps + algebraOps;
  const longStatement = message.length > LONG_STATEMENT_CHARS;
  const grade12Anchor = (conceptSlug ?? '').startsWith('g12-');

  const score =
    (proof ? 3 : 0) +
    (multiPart ? 2 : 0) +
    Math.min(calcOps * 2 + algebraOps, 3) +
    (longStatement ? 1 : 0) +
    (grade12Anchor ? 1 : 0);

  return {
    level: score >= HARD_THRESHOLD ? 'hard' : 'simple',
    score,
    signals: { proof, multiPart, advancedOpClasses, longStatement, grade12Anchor },
  };
}

/**
 * Task-ul de chat rutat pe dificultate (C2):
 *  - admin → chat_admin (neatins);
 *  - hard → chat_hard (Sonnet) pentru TOȚI — gardul de buget poate retrograda;
 *  - simple → chat_simple (Haiku) pentru premium (cu verify activ ca plasă),
 *    chat_free (Haiku) pentru free (același model; numele păstrează bugetarea).
 */
export function routeChatTask(level: Difficulty, status: string): string {
  if (status === 'admin') return 'chat_admin';
  const premium = status === 'premium' || status.startsWith('family');
  if (level === 'hard') return 'chat_hard';
  return premium ? 'chat_simple' : 'chat_free';
}
