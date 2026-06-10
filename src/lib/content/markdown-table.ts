/**
 * markdown-table.ts — ETAPA 73 FAZA D1: tabelele markdown din ENUNȚURI.
 *
 * Bug-ul dovedit în screenshot: enunțuri cu tabel markdown (|a|h|m|...)
 * afișau pipe-urile BRUT prin MathText. Aici: detectăm blocul de tabel,
 * îl extragem ca DATE (pentru LessonTable), iar textul din jur rămâne text.
 * Pur — testat în tests/content/markdown-table.test.ts.
 */

export interface ExtractedTable {
  before: string;
  columns: string[];
  rows: string[][];
  after: string;
}

const SEP_RE = /^\s*\|?[\s:|-]+\|?\s*$/; // linia |---|:--:|---|

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/** primul tabel markdown valid din text; null dacă nu există */
export function extractMarkdownTable(text: string): ExtractedTable | null {
  const lines = text.split('\n');
  for (let i = 0; i + 1 < lines.length; i++) {
    const header = lines[i];
    const sep = lines[i + 1];
    if (!header.includes('|') || !SEP_RE.test(sep) || !sep.includes('-')) continue;
    const columns = splitRow(header);
    if (columns.length < 2) continue;
    const rows: string[][] = [];
    let j = i + 2;
    for (; j < lines.length; j++) {
      if (!lines[j].includes('|')) break;
      const cells = splitRow(lines[j]);
      if (cells.length < 2) break;
      // normalizăm la numărul de coloane (celule lipsă → gol)
      rows.push(columns.map((_, k) => cells[k] ?? ''));
    }
    if (rows.length === 0) continue;
    return {
      before: lines.slice(0, i).join('\n').trim(),
      columns,
      rows,
      after: lines.slice(j).join('\n').trim(),
    };
  }
  return null;
}

/**
 * Enunț care NU se poate randa curat: conține pipe-uri de tabel care NU
 * parsează ca tabel valid. (FAZA D1: un astfel de exercițiu nu intră în
 * daily/lecție — marcat, nu afișat stricat.)
 */
export function hasUnrenderableMarkdown(text: string): boolean {
  const pipeLines = text.split('\n').filter((l) => (l.match(/\|/g) ?? []).length >= 2);
  if (pipeLines.length === 0) return false;
  // |x| e legitim ca modúl matematic DOAR în interiorul delimitatorilor $;
  // în afara lor, ≥2 linii consecutive cu pipe-uri = încercare de tabel
  const outsideMath = text.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, '');
  const rawPipeLines = outsideMath.split('\n').filter((l) => (l.match(/\|/g) ?? []).length >= 2);
  if (rawPipeLines.length < 2) return false;
  return extractMarkdownTable(text) === null;
}
