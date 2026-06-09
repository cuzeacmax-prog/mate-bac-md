/**
 * ETAPA 67 FAZA F — raportul stratificării: pe câte din figurile legate
 * (acceptate, cu exercise_id) SVG-ul produce ≥2 straturi semantice
 * (<g data-layer>)? Fără straturi → figura apare întreagă (MARCAT, nu forțat).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa67-layers-report.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { renderSVG } from '../../src/lib/figures/render-svg';
import type { FigureSpec3D } from '../../src/lib/figures/spec3d';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const { data: figs } = await svc
    .from('figura_autor')
    .select('slug, exercise_id, spec_generat')
    .not('exercise_id', 'is', null)
    .in('status', ['approved', 'auto-acceptat'])
    .not('spec_generat', 'is', null);
  if (!figs?.length) fail('nicio figură legată cu spec');

  let layered = 0;
  const detail: string[] = [];
  for (const f of figs) {
    let layers = 0;
    let ok = true;
    try {
      const svg = renderSVG(f.spec_generat as FigureSpec3D);
      const found = new Set([...svg.matchAll(/data-layer="(\d)"/g)].map((m) => m[1]));
      layers = found.size;
      if (layers >= 2) layered++;
    } catch (err) {
      ok = false;
      console.error(`  ${f.slug}: randare eșuată — ${err instanceof Error ? err.message : err}`);
    }
    detail.push(`  ${f.slug}: ${ok ? `${layers} straturi${layers >= 2 ? ' ✓ stratificabilă' : ' → ÎNTREAGĂ (marcat)'}` : 'EROARE'}`);
  }
  console.log(`── figurile legate: ${figs.length} ──`);
  for (const d of detail) console.log(d);
  console.log(`\nSTRATIFICABILE: ${layered}/${figs.length}; restul apar întregi (MARCAT, fără spec semantic suficient).`);

  // dovada pe figura aprinsă: b47-033 trebuie să fie stratificabilă (are segment3d + rightAngle3d)
  const lit = figs.find((f) => f.slug === 'b47-033-f6eb97ce');
  if (lit) {
    const svg = renderSVG(lit.spec_generat as FigureSpec3D);
    if (!svg.includes('data-layer="0"') || !svg.includes('data-layer="2"')) {
      fail('b47-033 nu are straturile 0+2 deși spec-ul conține polyhedron + segment3d');
    }
    console.log('\nb47-033-f6eb97ce: straturi prezente —',
      [...new Set([...svg.matchAll(/data-layer="(\d)"/g)].map((m) => m[1]))].sort().join(','));
  }
  console.log('\n✅ FAZA F: stratificarea funcționează pe figurile cu spec semantic; restul marcate onest.');
}
main().catch((e) => { console.error(e); process.exit(1); });
