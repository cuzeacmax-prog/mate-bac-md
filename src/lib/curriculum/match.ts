/**
 * match.ts — ETAPA 83 FAZA A2: potrivirea CONCEPT → CLASĂ din cuprinsul manualelor.
 *
 * R5 (absolut): maparea se EXTRAGE din manuale, nu se ghicește. Determinist + ONEST:
 * propune o clasă FERM doar când conceptul se regăsește CLAR și UNIC într-un titlu
 * de temă/modul de bază al unei singure clase. Altfel → 'nesigur' (Maxim e arbitrul).
 *
 * Lecție din rulajul brut: potrivirea pe UN singur cuvânt comun (real/funcția/unghi/
 * geometrică) produce ferme false. De aceea potrivim la nivel de ENTRY (un titlu),
 * cerem acoperire mare + ≥2 tokeni (sau 1 token distinctiv), cu stemming ușor.
 */

export interface CuprinsTheme { title: string; page: number }
export interface CuprinsModule { title: string; page: number; themes: CuprinsTheme[]; isRecap?: boolean }
export interface ClassCuprins { grade: number; sourceFile?: string; modules: CuprinsModule[] }
export interface ConceptLite { slug: string; name: string; grade_level: number | null }

export interface MatchResult {
  proposedGrade: number | null;
  confidence: 'firm' | 'nesigur';
  candidates: Array<{ grade: number; entry: string; page: number; coverage: number }>;
  source: string | null;
  isChange: boolean;
  reason: string;
}

/** lowercase + scoate diacriticele + normalizează spațiile */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// cuvinte structurale/grammaticale — fără valoare de topic
const STOP = new Set([
  'si', 'de', 'cu', 'in', 'la', 'al', 'ale', 'unei', 'unui', 'lui', 'pe', 'prin', 'din', 'sau',
  'ei', 'sa', 'se', 'ca', 'cele', 'cel', 'cea', 'intre', 'sub', 'spre', 'fata', 'forma',
  'modulul', 'capitolul', 'recapitulare', 'completari', 'exercitii', 'probleme', 'proba',
  'evaluare', 'test', 'sumativ', 'propuse', 'recapitulative', 'notiunea', 'notiune', 'elemente',
  'generalitati', 'tipuri', 'unor', 'unele', 'alte', 'aplicatii', 'metode', 'calcul', 'calculul',
]);

/** tokeni de conținut: folded, fără stopwords, ≥3 caractere (păstrăm „ii"→nu, dar „iii" da) */
export function conceptTokens(name: string): string[] {
  return fold(name).split(' ').filter((t) => t.length >= 3 && !STOP.has(t));
}

/** stemming ușor RO: taie pluraluri/articole comune ca poliedru/poliedre → poliedr */
export function stem(tok: string): string {
  let t = tok;
  for (const suf of ['urilor', 'elor', 'ilor', 'urile', 'urii', 'iile', 'uri', 'ele', 'ile', 'lor', 'ului', 'ul', 'le']) {
    if (t.length - suf.length >= 4 && t.endsWith(suf)) { t = t.slice(0, -suf.length); break; }
  }
  // taie o vocală finală pentru singular/plural (poliedru/poliedre/poliedra → poliedr)
  if (t.length >= 5 && /[aeiou]$/.test(t)) t = t.slice(0, -1);
  return t;
}

const stemSet = (toks: string[]) => new Set(toks.map(stem));

// tokeni prea generici ca să plaseze SINGURI un concept (apar în zeci de titluri)
const WEAK = new Set(['real', 'functi', 'unghi', 'punct', 'figur', 'drept', 'plan', 'geometri',
  'algebri', 'numar', 'numer', 'expresi', 'arie', 'arii', 'ecuati', 'inecuati', 'sistem',
  'operati', 'proprietat', 'grafic', 'multim', 'relati', 'puter'].map(stem));

interface Entry { grade: number; title: string; page: number; tokens: Set<string>; sourceFile?: string }

export function buildClassIndex(curriculum: ClassCuprins[]): Entry[] {
  const entries: Entry[] = [];
  for (const c of curriculum) {
    for (const m of c.modules) {
      const recap = !!m.isRecap || /recapitulare\s+final/i.test(fold(m.title));
      if (recap) continue; // modulele de recapitulare re-listează alte clase → nu sunt „clasa de origine"
      const all: Array<{ title: string; page: number }> = [{ title: m.title, page: m.page }, ...m.themes];
      for (const e of all) {
        entries.push({ grade: c.grade, title: e.title, page: e.page, tokens: stemSet(conceptTokens(e.title)), sourceFile: c.sourceFile });
      }
    }
  }
  return entries;
}

/**
 * FERM doar dacă: conceptul se potrivește clar într-un ENTRY (acoperire ≥ 0.75 din
 * tokenii conceptului ȘI fie ≥2 tokeni, fie 1 token distinctiv non-weak) ȘI toate
 * entry-urile care-l potrivesc sunt din ACEEAȘI clasă. Altfel → nesigur.
 */
export function matchConcept(concept: ConceptLite, entries: Entry[]): MatchResult {
  const raw = conceptTokens(concept.name);
  const toks = raw.map(stem);
  const cur = concept.grade_level;
  if (toks.length === 0) {
    return { proposedGrade: null, confidence: 'nesigur', candidates: [], source: null, isChange: false, reason: 'titlu fără tokeni de conținut' };
  }
  const distinctive = toks.filter((t) => !WEAK.has(t));

  const matches: Array<{ grade: number; entry: string; page: number; coverage: number; sourceFile?: string }> = [];
  for (const e of entries) {
    const hit = toks.filter((t) => e.tokens.has(t));
    if (hit.length === 0) continue;
    const coverage = hit.length / toks.length;
    const hitDistinctive = hit.filter((t) => !WEAK.has(t)).length;
    // FERM cere: acoperire mare + cel puțin un token DISTINCTIV (nu doar cuvinte
    // generice ca grafic/funcție) + fie ≥2 tokeni, fie unicul token e distinctiv.
    const strong =
      coverage >= 0.75 &&
      hitDistinctive >= 1 &&
      (hit.length >= 2 || (toks.length === 1 && distinctive.length === 1));
    if (strong) matches.push({ grade: e.grade, entry: e.title, page: e.page, coverage, sourceFile: e.sourceFile });
  }

  if (matches.length === 0) {
    return { proposedGrade: null, confidence: 'nesigur', candidates: [], source: null, isChange: false, reason: 'nicio potrivire clară în cuprins (rămâne pentru Maxim)' };
  }

  const grades = [...new Set(matches.map((m) => m.grade))];
  const candidates = matches
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 6)
    .map((m) => ({ grade: m.grade, entry: m.entry, page: m.page, coverage: Math.round(m.coverage * 100) / 100 }));

  if (grades.length > 1) {
    return { proposedGrade: null, confidence: 'nesigur', candidates, source: null, isChange: false, reason: `apare clar în ${grades.length} clase (${grades.join(', ')}) — ambiguu` };
  }

  const grade = grades[0];
  const best = matches.find((m) => m.grade === grade)!;
  const file = best.sourceFile?.split(/[\\/]/).pop() ?? `clasa-${String(grade).padStart(2, '0')}.pdf`;
  return {
    proposedGrade: grade,
    confidence: 'firm',
    candidates,
    source: `${file} — „${best.entry}" (p. ${best.page})`,
    isChange: cur !== grade,
    reason: `potrivire fermă unică în clasa ${grade} (acoperire ${Math.round(best.coverage * 100)}%)`,
  };
}
