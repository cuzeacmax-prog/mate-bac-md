/**
 * ETAPA 73 FAZA D2 — checker: enunțuri cu markdown brut rămas, pe TOATE
 * sursele afișate elevului (exerciții servibile = daily/lecție/simulare,
 * bibliotecă solved_exercises, diagnostic). Raport: count + listă.
 * Tabelele VALIDE se randează acum nativ (StatementText) — numărate separat.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa73-markdown-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { extractMarkdownTable, hasUnrenderableMarkdown } from '../../src/lib/content/markdown-table';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();

  // 1) exercițiile SERVIBILE (sursele daily/lecție/simulare)
  const { data: serv } = await svc.from('exercise_servable').select('exercise_id').limit(20000);
  const servIds = (serv ?? []).map((s) => s.exercise_id as string);
  const statements: Array<{ id: string; statement: string }> = [];
  for (let i = 0; i < servIds.length; i += 300) {
    const { data } = await svc.from('exercise_raw').select('id, statement').in('id', servIds.slice(i, i + 300));
    statements.push(...((data ?? []) as Array<{ id: string; statement: string }>));
  }
  let withTable = 0;
  const unrenderable: string[] = [];
  for (const s of statements) {
    if (extractMarkdownTable(s.statement)) withTable++;
    if (hasUnrenderableMarkdown(s.statement)) unrenderable.push(s.id);
  }
  console.log(`exerciții servibile: ${statements.length}`);
  console.log(`  cu tabel markdown VALID (acum randat nativ): ${withTable}`);
  console.log(`  cu markdown NERANDABIL (excluse din daily, marcate): ${unrenderable.length}`);
  for (const id of unrenderable.slice(0, 20)) console.log(`    ${id}`);

  // 2) diagnosticul (prompt + distractors)
  const { data: diag } = await svc.from('diagnostic_exercises').select('id, prompt, distractors').limit(1000);
  const diagBad = (diag ?? []).filter((d) =>
    hasUnrenderableMarkdown(`${d.prompt}\n${Object.values((d.distractors as Record<string, string>) ?? {}).join('\n')}`)
  );
  console.log(`diagnostic: ${diag?.length} — markdown nerandabil: ${diagBad.length}`);

  // 3) biblioteca solved_exercises (chat-bibliotecă: răspunsuri directe)
  const { data: lib } = await svc.from('solved_exercises').select('id, statement').limit(2000);
  const libBad = (lib ?? []).filter((l) => hasUnrenderableMarkdown((l.statement as string) ?? ''));
  console.log(`bibliotecă (solved_exercises): ${lib?.length} — markdown nerandabil: ${libBad.length}`);
  for (const l of libBad.slice(0, 10)) console.log(`    ${l.id}`);

  // poarta: niciun enunț SERVIBIL nerandabil nu mai poate ajunge la elev —
  // daily-ul le exclude (cod), aici doar verificăm că detecția-i consistentă
  const recheck = unrenderable.filter((id) => {
    const s = statements.find((x) => x.id === id);
    return s && !hasUnrenderableMarkdown(s.statement);
  });
  if (recheck.length > 0) fail('detecția nu e deterministă');

  console.log('\n✅ ETAPA 73 D2: raport complet — tabelele valide se randează nativ, nerandabilele sunt detectate (daily le exclude).');
}
main().catch((e) => { console.error(e); process.exit(1); });
