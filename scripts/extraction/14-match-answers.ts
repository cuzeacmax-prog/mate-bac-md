/**
 * 14-match-answers.ts — ETAPA 12: matching exercițiu↔răspuns (PROBĂ pe un modul). PUR, FĂRĂ AI.
 *
 * Rulează:  npm run extract:match -- --module "Modulul III"
 *
 * Leagă exercise_raw ↔ exercise_answers prin exercise_answer_link. Normalizare deterministă:
 *   - problem_number/exercise_number → (base_number, subpart) curățat de §, paranteze, prefixe romane.
 *   - subpart din litera subpunctului (1a → nr=1, sub=a).
 * Atribuirea răspuns→modul: cheia NU numește modulele, deci pentru probă folosim un interval de
 * PAGINI configurat per modul (heuristică de probă, dedusă din inspecție). Match în ACELAȘI modul:
 *   exact = base+subpart unic; fuzzy = doar base (sau ambiguu). Nepotrivit → NU scrie rând.
 *
 * Idempotent: șterge link-urile exercițiilor modulului înainte. READ-ONLY pe rest.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SOURCE = 'culegere_12_2';
// Heuristică de probă: paginile cheii care conțin răspunsurile fiecărui modul (din inspecție).
const MODULE_ANSWER_PAGES: Record<string, number[]> = {
  'Modulul III': [151, 152, 153],
};

function makeClient(url: string, key: string) { return createClient(url, key); }

/** Parsează un număr de problemă/exercițiu → { base, sub } curățat. Pur. */
function parseNum(raw: string): { base: string | null; sub: string | null } {
  let s = (raw ?? '').trim();
  s = s.replace(/^§\s*\d+\.?\s*/i, '');             // "§2. "
  s = s.replace(/^MODULUL\s+[IVXLC]+\.?\s*/i, '');  // "MODULUL V "
  s = s.replace(/^[IVXLC]+\.\s*/i, '');             // "I. ", "II. "
  s = s.replace(/\s+/g, ' ').trim();
  let m = s.match(/^(\d+)\s*[.)]?\s*([a-z])\s*\)?$/i);  // 1a, 1.a), 4 b, 80a
  if (m) return { base: m[1], sub: m[2].toLowerCase() };
  m = s.match(/^(\d+)\s*[.)]?$/);                       // 14, 14.
  if (m) return { base: m[1], sub: null };
  m = s.match(/^([a-z])\s*\)?$/i);                      // orfan "b"
  if (m) return { base: null, sub: m[1].toLowerCase() };
  const d = s.match(/^(\d+)/);
  return { base: d ? d[1] : null, sub: null };
}

/** Litera de subpunct din textul unui subpart ("a) ..." → "a"). */
function subLetter(s: string): string | null {
  const m = (s ?? '').match(/^\s*\(?([a-z])\)?[.)]/i) || (s ?? '').match(/^\s*\(?([a-z])\)/i);
  return m ? m[1].toLowerCase() : null;
}

async function main() {
  const { values } = parseArgs({ options: { module: { type: 'string' } } });
  const targetModule = values.module ?? 'Modulul III';
  const answerPages = MODULE_ANSWER_PAGES[targetModule];
  if (!answerPages) { console.error(`❌ Niciun interval de pagini configurat pentru "${targetModule}".`); process.exit(1); }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = makeClient(url, key);

  // 1. Exercițiile modulului.
  interface Ex { id: string; exercise_number: string; section: string | null; statement: string; subparts: string[] }
  const { data: exData, error: exErr } = await supabase.from('exercise_raw')
    .select('id, exercise_number, section, statement, subparts').eq('source', SOURCE).eq('module', targetModule);
  if (exErr) throw new Error(`exercise_raw: ${exErr.message}`);
  const exercises: Ex[] = (exData ?? []).map((e) => ({ id: e.id as string, exercise_number: (e.exercise_number as string) ?? '', section: (e.section as string | null) ?? null, statement: (e.statement as string) ?? '', subparts: Array.isArray(e.subparts) ? (e.subparts as string[]) : [] }));

  // 2. Răspunsurile modulului (interval de pagini-probă).
  interface Ans { id: string; pdf_page: number; section: string | null; problem_number: string; answer_text: string }
  const { data: ansData, error: ansErr } = await supabase.from('exercise_answers')
    .select('id, pdf_page, test_or_section, problem_number, answer_text').eq('source', SOURCE).in('pdf_page', answerPages);
  if (ansErr) throw new Error(`exercise_answers: ${ansErr.message}`);
  const answers: Ans[] = (ansData ?? []).map((a) => ({ id: a.id as string, pdf_page: a.pdf_page as number, section: (a.test_or_section as string | null) ?? null, problem_number: (a.problem_number as string) ?? '', answer_text: (a.answer_text as string) ?? '' }));

  console.log(`🎯 ${targetModule}: ${exercises.length} exerciții · ${answers.length} răspunsuri candidate (pg ${answerPages.join(',')}).`);

  // 3. Indexează răspunsurile pe (base|sub) și pe base.
  const byBaseSub = new Map<string, string[]>();
  const byBase = new Map<string, string[]>();
  for (const a of answers) {
    const { base, sub } = parseNum(a.problem_number);
    if (base == null) continue;
    const k = `${base}|${sub ?? ''}`;
    (byBaseSub.get(k) ?? byBaseSub.set(k, []).get(k)!).push(a.id);
    (byBase.get(base) ?? byBase.set(base, []).get(base)!).push(a.id);
  }

  // 4. Matching.
  interface Link { exercise_id: string; subpart: string | null; answer_id: string; match_confidence: 'exact' | 'fuzzy' }
  const links: Link[] = [];
  const consumed = new Set<string>();
  const exExact = new Set<string>(), exFuzzy = new Set<string>();

  const pick = (bs: string[] | undefined, base: string): { id: string; conf: 'exact' | 'fuzzy' } | null => {
    if (bs && bs.length === 1) return { id: bs[0], conf: 'exact' };
    if (bs && bs.length > 1) return { id: bs[0], conf: 'fuzzy' };           // ambiguu pe base+sub
    const b = byBase.get(base);
    if (b && b.length >= 1) return { id: b[0], conf: 'fuzzy' };             // doar base
    return null;
  };

  for (const ex of exercises) {
    const { base } = parseNum(ex.exercise_number);
    if (base == null) continue;
    const subLetters = ex.subparts.map(subLetter).filter((x): x is string => !!x);
    if (subLetters.length > 0) {
      for (const L of subLetters) {
        const r = pick(byBaseSub.get(`${base}|${L}`), base);
        if (!r) continue;
        links.push({ exercise_id: ex.id, subpart: L, answer_id: r.id, match_confidence: r.conf });
        consumed.add(r.id);
        (r.conf === 'exact' ? exExact : exFuzzy).add(ex.id);
      }
    } else {
      const r = pick(byBaseSub.get(`${base}|`), base);
      if (!r) continue;
      links.push({ exercise_id: ex.id, subpart: null, answer_id: r.id, match_confidence: r.conf });
      consumed.add(r.id);
      (r.conf === 'exact' ? exExact : exFuzzy).add(ex.id);
    }
  }

  // 5. Idempotent: șterge link-urile exercițiilor acestui modul, apoi insert.
  const exIds = exercises.map((e) => e.id);
  for (let i = 0; i < exIds.length; i += 100) {
    await supabase.from('exercise_answer_link').delete().in('exercise_id', exIds.slice(i, i + 100));
  }
  for (let i = 0; i < links.length; i += 500) {
    const { error } = await supabase.from('exercise_answer_link').insert(links.slice(i, i + 500));
    if (error) throw new Error(`Insert link [${i}]: ${error.message}`);
  }

  // 6. VERIFICARE din DB + raport.
  const exExactOnly = [...exExact];
  const exFuzzyOnly = [...exFuzzy].filter((id) => !exExact.has(id));
  const linkedEx = new Set([...exExact, ...exFuzzy]);
  const unlinked = exercises.filter((e) => !linkedEx.has(e.id)).length;
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const ansById = new Map(answers.map((a) => [a.id, a]));

  console.log('\n──────── VERIFICARE MATCHING (din DB reală) ────────');
  console.log(`${targetModule}: ${exercises.length} exerciții`);
  console.log(`  ├─ cu răspuns EXACT:   ${exExactOnly.length}`);
  console.log(`  ├─ cu răspuns FUZZY:   ${exFuzzyOnly.length}`);
  console.log(`  └─ NELEGATE:           ${unlinked}`);
  console.log(`Răspunsuri candidate (${targetModule}, pg ${answerPages.join(',')}): ${answers.length}`);
  console.log(`  ├─ consumate (legate): ${consumed.size}`);
  console.log(`  └─ neatribuite:        ${answers.length - consumed.size}`);
  console.log(`Total link-uri scrise:   ${links.length}  (exact ${links.filter((l) => l.match_confidence === 'exact').length} / fuzzy ${links.filter((l) => l.match_confidence === 'fuzzy').length})`);

  console.log('\nEșantion (3 perechi exercițiu↔răspuns):');
  for (const l of links.slice(0, 3)) {
    const ex = exById.get(l.exercise_id); const an = ansById.get(l.answer_id);
    console.log(`\n  [${l.match_confidence}] ex nr.${ex?.exercise_number}${l.subpart ? ` (${l.subpart})` : ''} · ${ex?.section ?? '—'}`);
    console.log(`    ENUNȚ: ${(ex?.statement ?? '').slice(0, 110)}`);
    console.log(`    RĂSPUNS [${an?.section ?? '—'} nr.${an?.problem_number}]: ${an?.answer_text}`);
  }
  console.log('\n✅ Doar exercise_answer_link. exercise_raw / exercise_answers / concepts / concept_edges: neatinse.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
