/**
 * ETAPA 81 — reparație mecanică (R5-sigur): câmpurile `formula`/`latex` din lecțiile
 * canonice trebuie să fie BARE (player-ul adaugă $$…$$). Unele lecții au formule
 * pre-delimitate cu $ → $$$…$$$ rupt. Strip-uim $-urile de la capete. NU schimbăm matematica.
 *   tsx --env-file=.env.local scripts/etapa75/fix-formula-delimiters.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';

const strip$ = (s: string) => (typeof s === 'string' ? s.replace(/^\$+/, '').replace(/\$+$/, '').trim() : s);

async function main() {
  const svc = createServiceClient();
  const { data: rows } = await svc.from('lesson_canonical').select('id, blocks');
  let fixed = 0;
  for (const r of rows ?? []) {
    const blocks = r.blocks as Array<Record<string, unknown>>;
    let changed = false;
    for (const b of blocks) {
      if (b.tip === 'step' && typeof b.formula === 'string') { const n = strip$(b.formula); if (n !== b.formula) { b.formula = n; changed = true; } }
      if (b.tip === 'formula' && typeof b.latex === 'string') { const n = strip$(b.latex); if (n !== b.latex) { b.latex = n; changed = true; } }
      if (b.tip === 'example' && Array.isArray(b.pasi)) for (const p of b.pasi as Array<Record<string, unknown>>) if (typeof p.formula === 'string') { const n = strip$(p.formula); if (n !== p.formula) { p.formula = n; changed = true; } }
    }
    if (changed) { await svc.from('lesson_canonical').update({ blocks }).eq('id', r.id); fixed++; }
  }
  console.log(`✅ formule reparate (strip $) în ${fixed} lecții.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
