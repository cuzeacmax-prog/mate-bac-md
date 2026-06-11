/**
 * self-contained.ts — ETAPA 74 B3: detectorul exercițiilor NE-AUTONOME.
 *
 * Clasa descoperită de owner: enunțuri extrase din culegere care referă un
 * context-mamă absent („folosind notațiile de mai sus", „în tabelul de mai
 * sus", „din figura alăturată" fără figură). Astfel de exerciții se MARCHEAZĂ
 * (self_contained=false) și ies din daily/lecție/simulare până la o decizie
 * de îmbinare cu contextul-mamă. NU se rescriu (R5).
 *
 * Detector pe fraze + STRUCTURĂ: referința e problemă doar dacă ținta
 * lipsește din enunț (tabel referit fără tabel inclus, figură referită fără
 * figură aprobată, notații referite fără definirea lor în enunț).
 */
import { extractMarkdownTable } from "@/lib/content/markdown-table";

/** enunțul CONȚINE un tabel (markdown sau mediu LaTeX array/tabular) */
function hasInlineTable(statement: string): boolean {
  return (
    extractMarkdownTable(statement) !== null ||
    /\\begin\{(array|tabular)\}/.test(statement)
  );
}

/** enunțul își definește singur notațiile („am notat cu", „notăm cu") */
function definesOwnNotation(statement: string): boolean {
  return /\b(am notat|not[ăa]m|se noteaz[ăa]|unde\s+\$)/i.test(statement);
}

export type SelfContainedIssue =
  | "notatii-externe"   // „folosind notațiile de mai sus" fără definirea lor
  | "tabel-absent"      // referă un tabel care nu există în enunț
  | "figura-absenta"    // referă o figură, dar exercițiul n-are figură servibilă
  | "referinta-externa"; // „de la exercițiul precedent", „din problema anterioară"

/**
 * Problemele de autonomie ale unui enunț. Gol = self-contained.
 * `hasFigure` = exercițiul are figură aprobată (figura_autor) care SE AFIȘEAZĂ.
 */
export function selfContainedIssues(statement: string, hasFigure: boolean): SelfContainedIssue[] {
  const issues: SelfContainedIssue[] = [];
  const s = statement.toLowerCase();

  // notații moștenite din afara enunțului
  if (
    /(folosind|utiliz[âa]nd|cu)\s+nota[țt]iile\s+(de mai sus|anterioare|introduse anterior|precedente)/.test(s) &&
    !definesOwnNotation(statement)
  ) {
    issues.push("notatii-externe");
  }

  // tabel referit POZIȚIONAL (de mai jos/sus, alăturat) sau de completat,
  // dar absent din enunț. „tabelul integralelor/derivatelor" e referință
  // canonică de manual (cunoștință generală), NU context absent — nu se flaghează.
  if (
    (/(în|din)\s+tabelul\s+(de mai jos|de mai sus|al[ăa]turat|urm[ăa]tor)/.test(s) ||
      /complet(a[țt]i|[ăa]m)\s+tabelul/.test(s)) &&
    !hasInlineTable(statement)
  ) {
    issues.push("tabel-absent");
  }

  // figură referită, dar exercițiul nu servește nicio figură
  if (
    /(din|în|conform)\s+(figura|desenul|imaginea)(\s+(al[ăa]turat[ăa]?|de mai (sus|jos)|urm[ăa]to(are|r)))?/.test(s) &&
    !hasFigure
  ) {
    issues.push("figura-absenta");
  }

  // referință explicită la alt exercițiu/problemă
  if (/(exerci[țt]iul|problema)\s+(precedent|anterio)/.test(s)) {
    issues.push("referinta-externa");
  }

  return issues;
}
