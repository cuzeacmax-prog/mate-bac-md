/**
 * ETAPA 75 FAZA B2 — generarea BUILD-TIME a lecțiilor canonice.
 *
 * Ținta: conceptele de pe frontierele reale ale userilor + toate cu conținut
 * servibil (~60). Model: cel mai bun din config (task lesson_canonical =
 * claude-fable-5), efort maxim — costul e O SINGURĂ DATĂ, servirea e ~gratis.
 *
 * R5 întărit + POARTA ANTI-FABRICAȚIE: lecția se construiește EXCLUSIV din
 * teoria grafului + exercițiile servibile + figura de teorie din registru;
 * validateCanonicalBlocks respinge orice referință inexistentă → un retry →
 * altfel conceptul se sare și se raportează (nu persistăm lecții invalide).
 *
 * Idempotent: conceptele cu lecție canonică existentă se sar (FORCE=1 le
 * regenerează ca versiune nouă).
 *
 *   npx tsx --env-file=.env.local scripts/etapa75/generate-canonical-lessons.ts
 *   GEN_LIMIT=3 ... (test) | CONCEPT=g12-piramida ... (unul singur) | FORCE=1
 */
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '../../src/lib/supabase/service';
import { getConceptAnchor } from '../../src/lib/concepts/anchor';
import { LESSON_SYSTEM_PROMPT, buildLessonConceptBlock } from '../../src/lib/lesson/prompt';
import { getTheoryFigure } from '../../src/lib/lesson/theory-figures/registry';
import { validateCanonicalBlocks } from '../../src/lib/lesson/canonical';
import { logApiUsage } from '../../src/lib/ai/usage-log';

const CANONICAL_ADDENDUM = `
MISIUNE SPECIALĂ: generezi LECȚIA CANONICĂ a acestui concept — va fi revizuită
de un profesor și servită multor elevi. Calitate maximă, zero grabă.

STRUCTURA OBLIGATORIE (în această ordine):
1. intro (exact unul);
2. teorie DOZATĂ în step-uri/formula — EXCLUSIV din teoria de referință primită;
3. blocul figure kind:'theory' imediat după intro, DOAR dacă contextul anunță figura canonică;
4. UN exemplu rezolvat COMPLET dintr-un exercițiu servibil primit, cu REDACTARE DE BAREM:
   DVA unde e cazul, pași numerotați cu justificare, verificare, răspunsul final clar;
5. 2-3 quiz-uri (fiecare cu indiciu + rezolvare) care testează FIX ce s-a predat;
6. recap (exact unul, max 3 puncte).

ANTI-FABRICAȚIE (regula R5, NEÎNCĂLCABILĂ): folosește EXCLUSIV teoria primită,
exercițiile primite (cu id-urile lor exacte) și figura anunțată. NU inventa
exerciții, date numerice noi, figuri sau formule care nu decurg din teorie.
Blocurile figure DOAR cu id-urile/slug-urile primite în context.

FORMAT DE IEȘIRE: răspunde DOAR cu un array JSON de blocuri valide pe schema
contractului. Fără markdown, fără text înainte sau după array.

FORME JSON EXACTE (validatorul respinge ORICE abatere):
- {"tip":"intro","titlu":"...","ideea_mare":"max 2 propoziții"}
- {"tip":"step","titlu_scurt":"...","corp":"max 3 propoziții","formula":"latex opțional"}
- {"tip":"formula","latex":"...","explicatie":"EXACT 1 propoziție, SUB 150 de caractere"}
- {"tip":"example","enunt":"...","pasi":[{"text":"EXACT 1 propoziție, sub 200 caractere","formula":"opțional"}]} — MAXIM 4 pași
- {"tip":"quiz","intrebare":"...","optiuni":{"a":"..","b":"..","c":"..","d":".."},"corecta":"a",
   "indiciu":"1 propoziție","rezolvare":["pas 1","pas 2"]} — rezolvare e ARRAY de 1-3 stringuri scurte, NICIODATĂ string simplu
- {"tip":"figure","kind":"theory","theory_slug":"..."} sau {"tip":"figure","kind":"exercise","exercise_id":"..."}
- {"tip":"recap","puncte":["...","...","..."]} — max 3 puncte, câte 1 propoziție SUB 150 de caractere
REGULĂ DE LUNGIME GLOBALĂ: orice propoziție-câmp (explicatie, indiciu, puncte, pasi.text) stă SUB 150 de caractere.

MANDAT v2 (ETAPA 81 — OBLIGATORIU; lecția fără interactiv unde conceptul îl permite e RESPINSĂ):
- conceptul e despre o FUNCȚIE cu parametru → include un parameter_slider;
  funcție/analiză fără parametru → un plot.
- conceptul e PROBABILITATE/COMBINATORICĂ → include un interactive_manipulative tactil
  (kind zaruri/urna/persoane/monede/carti) cu numerele EXACTE din exercițiu.
- ai un TABEL care se construiește pas cu pas (semn, variație, Viète) → progressive_table
  în loc de table.
- GEOMETRIE cu figură anunțată → reveal_figure pe straturi.
- include cel puțin UN try_step la un pas de calcul cheie.
FORME JSON ale blocurilor interactive:
- {"tip":"parameter_slider","expr_template":"a*x^2","param":"a","range":[-3,3,0.5],"observe":"forma parabolei","domain":[-5,5]}
- {"tip":"progressive_table","coloane":["x","semn"],"randuri":[{"cells":["-∞;1","+"],"reveal_at_step":0,"highlight_cell":1}]}
- {"tip":"reveal_figure","figure_kind":"theory","theory_slug":"...","layers":[{"step_index":0,"elements":["axe"],"caption":"..."}]}
- {"tip":"interactive_manipulative","kind":"urna","params":"{\\"bile\\":[{\\"culoare\\":\\"rosu\\",\\"n\\":3}]}","mode":"tactile"}
- {"tip":"try_step","prompt":"Cât e f(2)?","expected":"5","hint":"Înlocuiește x cu 2."}

VOCABULAR CO-GENERAT (ETAPA 81 C3): la blocurile intro și step, pe lângă textul de bază
(registrul „punte"), adaugă câmpul "variante":{"comun":"...","barem":"..."} cu ACEEAȘI idee
în registru comun (zero jargon) și de barem (riguros). Matematica e identică; doar proza diferă.
ÎN VARIANTE, ca peste tot: ORICE notație matematică (inclusiv x^2, e^x, a_n) stă DOAR între
$...$ — text brut cu „^" sau „_" face lecția să fie RESPINSĂ.`;

interface TaskConfig { model_name: string; max_tokens: number; price_input_per_1m: number; price_output_per_1m: number }

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

async function pickTargets(svc: ReturnType<typeof createServiceClient>): Promise<string[]> {
  // (a) toate conceptele cu exerciții servibile
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id');
  const servableIds = (servable ?? []).map((s) => s.exercise_id as string);
  const conceptCount = new Map<string, number>();
  for (let i = 0; i < servableIds.length; i += 200) {
    const { data: links } = await svc
      .from('exercise_concept_link')
      .select('concept_id, exercise_id')
      .in('exercise_id', servableIds.slice(i, i + 200));
    for (const l of links ?? []) {
      conceptCount.set(l.concept_id as string, (conceptCount.get(l.concept_id as string) ?? 0) + 1);
    }
  }
  // (b) frontierele reale ale userilor cu evidență
  const { data: users } = await svc.from('concept_mastery').select('user_id').limit(5000);
  const userIds = [...new Set((users ?? []).map((u) => u.user_id as string))];
  const frontierIds = new Set<string>();
  for (const uid of userIds) {
    const { data: rows } = await svc.rpc('frontier_concepts', { p_user_id: uid, p_grade: 12, p_limit: 10 });
    for (const r of (rows ?? []) as Array<{ concept_id: string }>) frontierIds.add(r.concept_id);
  }
  const targetIds = new Set<string>([...conceptCount.keys(), ...frontierIds]);
  // slug-urile, ordonate: întâi cele cu mai mult conținut servibil
  const ids = [...targetIds];
  const slugById = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: cs } = await svc.from('concepts').select('id, slug').in('id', ids.slice(i, i + 200));
    for (const c of cs ?? []) slugById.set(c.id as string, c.slug as string);
  }
  return ids
    .sort((a, b) => (conceptCount.get(b) ?? 0) - (conceptCount.get(a) ?? 0))
    .map((id) => slugById.get(id)!)
    .filter(Boolean);
}

async function main() {
  const svc = createServiceClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { data: cfgRow, error: cfgErr } = await svc
    .from('ai_model_config')
    .select('model_name, max_tokens, price_input_per_1m, price_output_per_1m')
    .eq('task_name', 'lesson_canonical')
    .eq('is_active', true)
    .single();
  if (cfgErr || !cfgRow) throw new Error(`config lesson_canonical lipsește: ${cfgErr?.message}`);
  const cfg = cfgRow as TaskConfig;
  console.log(`model: ${cfg.model_name} ($${cfg.price_input_per_1m}/$${cfg.price_output_per_1m} per 1M)`);

  let slugs = process.env.CONCEPT ? [process.env.CONCEPT] : await pickTargets(svc);
  // ETAPA 81: ONLY_EXISTING=1 → regenerează DOAR conceptele care au deja lecție
  // canonică (cele 87), fără a crea lecții noi pentru alte concepte servibile.
  if (process.env.ONLY_EXISTING === '1') {
    const withLesson = new Set<string>();
    const { data: lc } = await svc.from('lesson_canonical').select('concepts(slug)');
    for (const r of (lc ?? []) as Array<{ concepts: { slug: string } | null }>) if (r.concepts?.slug) withLesson.add(r.concepts.slug);
    slugs = slugs.filter((s) => withLesson.has(s));
  }
  const limit = Number(process.env.GEN_LIMIT ?? 70);
  slugs = slugs.slice(0, limit);
  console.log(`ținte: ${slugs.length} concepte`);

  let generated = 0, skipped = 0, failed = 0;
  let totalCost = 0, totalIn = 0, totalOut = 0;
  const failures: string[] = [];

  for (const slug of slugs) {
    const anchor = await getConceptAnchor(svc, slug, 4);
    if (!anchor) { failures.push(`${slug}: concept inexistent`); failed++; continue; }

    // idempotent: sare conceptele cu lecție existentă; REGEN_BEFORE=<ISO> =
    // regenerare RELUABILĂ (doar versiunile generate înainte de cutoff —
    // ETAPA 77 B2: mandatul de vizual cere regenerarea celor vechi)
    const { data: existing } = await svc
      .from('lesson_canonical')
      .select('id, version, generated_at')
      .eq('concept_id', anchor.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const regenBefore = process.env.REGEN_BEFORE;
    const needsRegen =
      !!existing && !!regenBefore && String(existing.generated_at) < regenBefore;
    if (existing && process.env.FORCE !== '1' && !needsRegen) { skipped++; continue; }

    const theoryEntry = getTheoryFigure(anchor.slug);
    const conceptBlock = buildLessonConceptBlock({
      conceptName: anchor.name,
      gradeLevel: anchor.grade_level ?? 12,
      theory: anchor.theory,
      exercises: anchor.exercises.map((e) => ({
        id: e.id, statement: e.statement, official_answer: e.official_answer, has_figure: e.has_figure,
      })),
      theoryFigure: theoryEntry ? { slug: anchor.slug, descriere: theoryEntry.descriere } : null,
    });
    // ETAPA 77 B1: vizual DISPONIBIL? → mandatul intră în poarta de validare
    const PLOTTABLE_RE = /funcți|integral|primitiv|derivat|polinom|grafic|subgrafic|rotaț|arie/i;
    const MANIP_RE = /probabilit|eveniment|combinat|permut|aranjament|fract|multim|statistic/i;
    const visualExpected =
      !!theoryEntry ||
      anchor.exercises.some((e) => e.has_figure) ||
      PLOTTABLE_RE.test(anchor.name) ||
      MANIP_RE.test(anchor.name);
    const ctx = {
      servableExerciseIds: new Set(anchor.exercises.map((e) => e.id)),
      theorySlug: theoryEntry ? anchor.slug : null,
      visualExpected,
    };

    const generate = async (extraNote: string) => {
      const t0 = Date.now();
      const stream = anthropic.messages.stream({
        model: cfg.model_name,
        max_tokens: cfg.max_tokens || 16000,
        system: [
          { type: 'text', text: LESSON_SYSTEM_PROMPT + CANONICAL_ADDENDUM, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: conceptBlock },
        ],
        messages: [
          {
            role: 'user',
            content: `Generează lecția CANONICĂ pentru conceptul: ${anchor.name}\nClasa: ${anchor.grade_level ?? 12}${
              visualExpected ? '\nVIZUAL OBLIGATORIU: acest concept permite un vizual (figură/plot/manipulativ) — lecția fără el va fi RESPINSĂ.' : ''
            }${extraNote}`,
          },
        ],
        thinking: { type: 'adaptive' },
        // DECIZIE DOVEDITĂ EMPIRIC: effort 'max' supragândea (30K+ tokeni de
        // thinking, output trunchiat la 32K, $2.68/concept FĂRĂ rezultat) —
        // exact capcana „max e predispus la overthinking" din documentație.
        // 'high' = cel mai înalt nivel care TERMINĂ task-ul structurat.
        output_config: { effort: 'high' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const final = await stream.finalMessage();
      const text = final.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('');
      if (final.stop_reason !== 'end_turn') {
        console.log(`    (stop_reason=${final.stop_reason}, text=${text.length} chars — probabil trunchiat)`);
      }
      const inTok = final.usage.input_tokens + (final.usage.cache_creation_input_tokens ?? 0) + (final.usage.cache_read_input_tokens ?? 0);
      const outTok = final.usage.output_tokens;
      const cost =
        ((final.usage.input_tokens + (final.usage.cache_creation_input_tokens ?? 0) * 1.25 + (final.usage.cache_read_input_tokens ?? 0) * 0.1) * cfg.price_input_per_1m +
          outTok * cfg.price_output_per_1m) / 1_000_000;
      totalIn += inTok; totalOut += outTok; totalCost += cost;
      void logApiUsage({
        userId: null,
        taskName: 'lesson_canonical',
        model: cfg.model_name,
        endpoint: 'build:lesson_canonical',
        inputTokens: inTok,
        outputTokens: outTok,
        cachedInputTokens: final.usage.cache_read_input_tokens ?? 0,
        latencyMsTotal: Date.now() - t0,
        costUsd: cost,
      });
      return { text, cost };
    };

    try {
      let { text, cost } = await generate('');
      let arr = extractJsonArray(text);
      let result = arr ? validateCanonicalBlocks(arr, ctx) : ({ ok: false, errors: ['ieșirea nu e un array JSON'] } as const);
      if (!result.ok) {
        console.log(`  ${slug}: respins (${result.errors.slice(0, 2).join('; ')}) — REGENEREZ o dată`);
        ({ text, cost } = await generate(`\n\nATENȚIE — încercarea anterioară a fost RESPINSĂ de poarta de validare:\n${result.errors.join('\n')}\nCorectează exact aceste probleme.`));
        arr = extractJsonArray(text);
        result = arr ? validateCanonicalBlocks(arr, ctx) : ({ ok: false, errors: ['ieșirea nu e un array JSON'] } as const);
      }
      if (!result.ok) {
        failures.push(`${slug}: ${result.errors.slice(0, 3).join('; ')}`);
        failed++;
        continue;
      }
      const version = existing ? (existing.version as number) + 1 : 1;
      const { error: insErr } = await svc.from('lesson_canonical').insert({
        concept_id: anchor.id,
        version,
        blocks: result.blocks,
        surse: { exercise_ids: anchor.exercises.map((e) => e.id), theory_figure: ctx.theorySlug },
        model: cfg.model_name,
        status: 'generat',
      });
      if (insErr) { failures.push(`${slug}: insert: ${insErr.message}`); failed++; continue; }
      generated++;
      console.log(`  ✓ ${slug} v${version}: ${result.blocks.length} blocuri, $${cost.toFixed(4)}`);
    } catch (err) {
      failures.push(`${slug}: ${err instanceof Error ? err.message.slice(0, 140) : err}`);
      failed++;
    }
  }

  console.log(`\n══ B2 RAPORT ══`);
  console.log(`generate: ${generated} · sărite (existau): ${skipped} · eșuate: ${failed}`);
  console.log(`cost total REAL: $${totalCost.toFixed(4)} (in=${totalIn} tokeni, out=${totalOut} tokeni)`);
  if (failures.length) {
    console.log(`\neșecuri (marcate, nu persistate):`);
    for (const f of failures) console.log(`  ✗ ${f}`);
  }
  if (failed > 0) process.exitCode = 2;
}
main().catch((e) => { console.error(e); process.exit(1); });
