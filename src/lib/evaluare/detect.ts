/**
 * detect.ts — ETAPA 63 P1: detecția încercării de răspuns în chat-ul ancorat.
 *
 * Pur (fără IO) și conservator: un mesaj e tratat ca încercare DOAR dacă
 * conține un candidat de răspuns matematic (număr / expresie / literă de
 * variantă) și nu e o întrebare. Fals-negativ e acceptabil (mesajul merge
 * normal la profesor); fals-pozitivul ar mișca mastery pe nimic — de evitat.
 */

export interface AttemptDetection {
  isAttempt: boolean;
  /** candidatul de răspuns extras (mesajul scurt întreg sau fragmentul final cu '=') */
  candidate: string;
}

const MATH_TOKEN = /\d|[=^√∫]|\\frac|\\sqrt|\\pi|\bpi\b|\bsqrt\b|\/|\bx\b/i;
// "(deci) răspuns(ul) (meu)? e/este ...", "am obținut ...", "rezultatul e ..."
const ANSWER_PHRASE = /(deci|așadar|asadar)?\s*(răspuns\w*|raspuns\w*|rezultat\w*|am obținut|am obtinut|îmi dă|imi da|soluția|solutia)\s*(meu|final\w*)?\s*[:=]?\s*(este|e)?\s+/i;
// literă de variantă singură: "a", "b)", "C."
const LETTER_ONLY = /^\s*([a-dA-D])[).\s]*$/;

export function detectAnswerAttempt(message: string): AttemptDetection {
  const text = message.trim();
  if (!text) return { isAttempt: false, candidate: "" };

  // întrebările nu sunt încercări ("de ce e 2?", "cum se rezolvă?")
  if (text.endsWith("?")) return { isAttempt: false, candidate: "" };
  if (/^(cum|de ce|ce inseamna|ce înseamnă|nu înțeleg|nu inteleg|explic|ajut)/i.test(text)) {
    return { isAttempt: false, candidate: "" };
  }

  // literă de variantă (a/b/c/d) — încercare directă
  const letter = text.match(LETTER_ONLY);
  if (letter) return { isAttempt: true, candidate: letter[1].toLowerCase() };

  if (!MATH_TOKEN.test(text)) return { isAttempt: false, candidate: "" };

  // mesaj scurt → întreg mesajul e candidatul
  if (text.length <= 80) {
    const afterPhrase = text.replace(ANSWER_PHRASE, "");
    return { isAttempt: true, candidate: (afterPhrase || text).trim() };
  }

  // mesaj lung (pași de lucru) → ultimul fragment cu '=' sau ultima linie cu math
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (MATH_TOKEN.test(lines[i])) {
      const line = lines[i].replace(ANSWER_PHRASE, "").trim();
      return { isAttempt: true, candidate: line };
    }
  }
  return { isAttempt: false, candidate: "" };
}
