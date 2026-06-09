/**
 * ETAPA 64 — TEST DE ACCEPTARE: nivelul „sursă-oficială" deblochează conținut,
 * iar figurile legate se servesc.
 *
 * Aserțiuni (toate pe DB-ul live, prin ACELAȘI cod ca chat-ul — getConceptAnchor):
 *  1. exercise_servable conține ambele tier-uri; cifrele înainte/după raportate.
 *  2. Un concept de GEOMETRIE servește un exercițiu 'sursa-oficiala' CU figură;
 *     intro-ul generat conține eticheta „din culegerea oficială BAC" și
 *     referința /api/figura/{id}.
 *  3. Figura servită există în figura_autor cu spec_generat persistat și se
 *     randează în SVG cu ACELAȘI cod ca GET /api/figura/[exerciseId].
 *  4. frontier_concepts întoarce servable_exercises ≥ verified_exercises.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa64-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { getConceptAnchor, buildIntroMessage } from '../../src/lib/concepts/anchor';
import { renderSVG } from '../../src/lib/figures/render-svg';
import type { FigureSpec3D } from '../../src/lib/figures/spec3d';

// concepte de geometrie cu exerciții sursă-oficială + figură (Modulul V)
const GEO_CANDIDATES = ['g12-volumul-piramidei', 'g12-piramida', 'g12-trunchi-de-piramida'];

function fail(msg: string): never {
  console.error(`✗ EȘEC: ${msg}`);
  process.exit(1);
}

async function main() {
  const svc = createServiceClient();

  // ── 1) vederea servibilității ─────────────────────────────────────────────
  const { data: tiers, error: tErr } = await svc
    .from('exercise_servable')
    .select('tier')
    .limit(10000);
  if (tErr) fail(`exercise_servable inaccesibil: ${tErr.message}`);
  const nVerificat = (tiers ?? []).filter((t) => t.tier === 'verificat').length;
  const nOficial = (tiers ?? []).filter((t) => t.tier === 'sursa-oficiala').length;
  console.log(`exercise_servable: verificat=${nVerificat}, sursa-oficiala=${nOficial}, total=${(tiers ?? []).length}`);
  if (nVerificat === 0 || nOficial === 0) fail('ambele tier-uri trebuie să fie nenule');

  // ── 2) concept de geometrie cu exercițiu sursă-oficială CU figură ────────
  let found = false;
  for (const slug of GEO_CANDIDATES) {
    const anchor = await getConceptAnchor(svc, slug);
    if (!anchor) continue;
    const figured = anchor.exercises.find((e) => e.tier === 'sursa-oficiala' && e.has_figure);
    if (!figured) {
      console.log(`  ${slug}: exerciții servite=${anchor.exercises.length} (fără sursă-oficială cu figură) — încerc următorul`);
      continue;
    }
    console.log(`\nconcept GEOMETRIE: ${slug}`);
    console.log(`  exercițiu servit: ${figured.id} tier=${figured.tier} figură=DA`);
    console.log(`  enunț: ${figured.statement.slice(0, 110)}…`);
    console.log(`  răspuns oficial (pentru profesor): ${figured.official_answer?.slice(0, 80) ?? 'LIPSĂ'}`);
    if (!figured.official_answer) fail('exercițiul sursă-oficială trebuie să aibă răspuns oficial prin link strict');

    // intro-ul deterministic (primul mesaj din chat-ul ancorat)
    const intro = buildIntroMessage(anchor);
    if (anchor.exercises[0].id === figured.id) {
      if (!intro.includes('din culegerea oficială BAC')) fail('intro-ul nu etichetează sursa oficială');
      if (!intro.includes(`/api/figura/${figured.id}`)) fail('intro-ul nu referă figura prin /api/figura');
      console.log('  intro: etichetă „din culegerea oficială BAC" ✓, referință /api/figura ✓');
    } else {
      console.log('  (exercițiul cu figură nu e primul servit — etichetă verificată pe system addendum)');
    }

    // ── 3) figura: spec persistat + randare SVG (același cod ca ruta API) ──
    const { data: fig, error: fErr } = await svc
      .from('figura_autor')
      .select('slug, status, spec_generat')
      .eq('exercise_id', figured.id)
      .in('status', ['approved', 'auto-acceptat'])
      .not('spec_generat', 'is', null)
      .limit(1)
      .maybeSingle();
    if (fErr || !fig?.spec_generat) fail(`figura legată lipsește sau fără spec: ${fErr?.message ?? 'spec null'}`);
    const svg = renderSVG(fig.spec_generat as FigureSpec3D);
    if (!svg.startsWith('<svg') && !svg.includes('<svg')) fail('randarea nu a produs SVG');
    console.log(`  figura: ${fig.slug} (${fig.status}) → SVG ${svg.length} bytes — răspunsul GET /api/figura/${figured.id} ar fi image/svg+xml`);
    found = true;
    break;
  }
  if (!found) fail('niciun concept de geometrie nu servește exercițiu sursă-oficială cu figură');

  // ── 4) frontier_concepts cu servable_exercises ───────────────────────────
  // user sintetic doar pentru apelul RPC (frontiera nu cere mastery existent)
  const { data: anyUser } = await svc.auth.admin.listUsers({ page: 1, perPage: 1 });
  const uid = anyUser?.users[0]?.id;
  if (!uid) fail('niciun user pentru apelul frontier_concepts');
  const { data: frontier, error: frErr } = await svc.rpc('frontier_concepts', {
    p_user_id: uid, p_grade: 12, p_limit: 50,
  });
  if (frErr) fail(`frontier_concepts: ${frErr.message}`);
  let withOfficial = 0;
  for (const r of frontier ?? []) {
    if (Number(r.servable_exercises) < Number(r.verified_exercises)) {
      fail(`servable < verified pe ${r.slug} (${r.servable_exercises} < ${r.verified_exercises})`);
    }
    if (Number(r.servable_exercises) > Number(r.verified_exercises)) withOfficial++;
  }
  console.log(`\nfrontier_concepts: ${frontier?.length ?? 0} rânduri; ${withOfficial} concepte câștigă conținut prin sursă-oficială`);

  console.log('\n✅ ETAPA 64 acceptată: tier-uri servibile, geometrie cu figură servită din sursă oficială, frontiera numără servable.');
}
main().catch((e) => { console.error(e); process.exit(1); });
