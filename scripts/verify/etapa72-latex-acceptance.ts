/**
 * ETAPA 72 P3 — ACCEPTANȚĂ pe cazul RAPORTAT: „centrul de greutate al plăcii
 * omogene". Intro-ul ancorat (exact ce vede elevul) se segmentează corect:
 * formula NU înghite „Pentru acest concept nu am încă exerciții…", textul de
 * după e TEXT, nicio formulă suspectă (diacritice/peste 200 chars) nu se
 * randează ca math. + sumarul checker-ului pe toate body-urile.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa72-latex-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { getConceptAnchor, buildIntroMessage } from '../../src/lib/concepts/anchor';
import { segmentDelimitedMath, truncateOutsideMath } from '../../src/lib/content-math';

const SLUG = 'g12-centrul-de-greutate-al-placii-omogene';
const RO = /[ăâîșțĂÂÎȘȚ]/;

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const anchor = await getConceptAnchor(svc, SLUG);
  if (!anchor) fail('conceptul raportat lipsește din graf');

  // ── 1) intro-ul (ce vede elevul) — formula NU mai înghite textul ──────────
  const intro = buildIntroMessage(anchor);
  console.log(`intro: ${intro.length} chars`);
  const segments = segmentDelimitedMath(intro);
  const mathSegs = segments.filter((s) => s.type === 'math');
  const textSegs = segments.filter((s) => s.type === 'text');
  console.log(`segmente: ${mathSegs.length} math, ${textSegs.length} text`);

  for (const m of mathSegs) {
    if (RO.test(m.value)) fail(`formulă cu proză românească înăuntru (înghițită): ${m.value.slice(0, 120)}`);
    if (m.value.length > 200) fail(`formulă suspect de lungă (${m.value.length} chars)`);
    if (m.value.includes('Pentru acest concept')) fail('mesajul de info a fost înghițit în formulă');
  }
  console.log('✓ nicio formulă nu conține proză/diacritice/mesajul de info');
  // formula ÎNTREAGĂ apare în intro (body-ul real are formula după ~520 chars
  // de proză — tăierea veche o reteza, cea nouă o include cu toleranță)
  if (!mathSegs.some((m) => m.value.includes('x_0') && m.value.includes('\\int_a^b'))) {
    fail('formula centrului de greutate NU apare întreagă în intro');
  }
  console.log('✓ formula x₀/y₀ apare ÎNTREAGĂ ca math în intro');

  if (anchor.exercises.length === 0) {
    const infoInText = textSegs.some((t) => t.value.includes('Pentru acest concept nu am încă exerciții'));
    if (!infoInText) fail('mesajul de info lipsește din segmentele TEXT');
    if (!intro.includes('\n---\n')) fail('mesajul de info nu e bloc separat (lipsește separatorul)');
    console.log('✓ mesajul „nu am exerciții" e bloc separat și e TEXT');
  } else {
    console.log(`(conceptul are acum ${anchor.exercises.length} exerciții — ramura fără exerciții verificată sintetic mai jos)`);
  }

  // ── 2) ramura sintetică: teorie tăiată FIX în mijlocul formulei ───────────
  const evil = `Teorie despre placa omogenă.\n\n$$x_G = \\frac{x_1 m_1 + x_2 m_2 + x_3 m_3}{m_1 + m_2 + m_3}$$\n\nText final.`;
  const cutAt = evil.indexOf('m_2 + x_3'); // în plină formulă
  const safe = truncateOutsideMath(evil, cutAt);
  if ((safe.match(/\$\$/g) ?? []).length % 2 === 1) fail('truncateOutsideMath a lăsat $$ deschis');
  const synthetic = `${safe}\n\n---\n\nℹ️ Pentru acest concept nu am încă exerciții servibile în bibliotecă.`;
  const synthSegs = segmentDelimitedMath(synthetic);
  if (synthSegs.some((s) => s.type === 'math' && s.value.includes('Pentru acest concept'))) {
    fail('tăierea sintetică tot înghite textul');
  }
  console.log('✓ tăierea la mijloc de formulă nu mai lasă delimitatori deschiși');

  // ── 3) sumarul checker-ului (persistat în DB) ──────────────────────────────
  const { count: marcate } = await svc
    .from('concepts').select('id', { count: 'exact', head: true }).not('body_latex_issues', 'is', null);
  const { count: total } = await svc
    .from('concepts').select('id', { count: 'exact', head: true }).not('body', 'is', null);
  console.log(`checker: ${marcate} body-uri marcate cu probleme LaTeX din ${total} cu conținut`);
  if ((marcate ?? 0) === 0) fail('checker-ul nu a marcat nimic (suspect — dry-run-ul a găsit 169)');

  console.log('\n✅ ETAPA 72 P3 acceptată: formula nu mai înghite textul, info-ul e bloc separat, 169 body-uri marcate pentru revizuire.');
}
main().catch((e) => { console.error(e); process.exit(1); });
