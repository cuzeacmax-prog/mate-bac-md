/**
 * ETAPA 75 D+E — ACCEPTANȚA „biblioteca răspunde prima" + embeddings persistate.
 *
 *  1. RATA DE POTRIVIRE pe mesajele istorice (role=user, 14 zile), pe ACELEAȘI
 *     mesaje: înainte (doar solved_exercises, 8 rânduri) vs după (+ pool-ul
 *     servibil cu embeddings persistate) — la pragul direct (0.85) și context (0.65);
 *  2. CAP-COADĂ: un enunț IDENTIC cu unul servibil din bibliotecă → /api/chat
 *     răspunde cu „Rezolvare verificată din bibliotecă" + costul apelului
 *     raportat (doar legătura narativă Haiku, nu re-rezolvare).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa75-library-first.ts
 */
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';
import { generateEmbeddingForQuery } from '../../src/lib/embeddings/gemini';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
const DIRECT = 0.85;
const CONTEXT = 0.65;

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

function buildAuthCookies(session: Session): string {
  const name = `sb-${REF}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0; i * MAX < value.length; i++) parts.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  return parts.join('; ');
}

async function main() {
  const svc = createServiceClient();

  // ── 1) rata de potrivire înainte/după, pe aceleași mesaje istorice ────────
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data: msgs } = await svc
    .from('messages')
    .select('content')
    .eq('role', 'user')
    .gte('created_at', since)
    .limit(300);
  const sample = (msgs ?? [])
    .map((m) => m.content as string)
    .filter((c) => !!c && !c.startsWith('Începe lecția') && c.length > 15)
    .slice(0, 60);
  let beforeDirect = 0, beforeContext = 0, afterDirect = 0, afterContext = 0;
  for (const text of sample) {
    const emb = await generateEmbeddingForQuery(text.slice(0, 4000));
    const [solved, servable] = await Promise.all([
      svc.rpc('match_exercises', { query_embedding: emb, match_threshold: CONTEXT, match_count: 1 }),
      svc.rpc('match_servable_exercises', { query_embedding: emb, match_threshold: CONTEXT, match_count: 1 }),
    ]);
    const sSim = solved.data?.[0]?.similarity ?? 0;
    const vSim = servable.data?.[0]?.similarity ?? 0;
    if (sSim >= DIRECT) beforeDirect++;
    if (sSim >= CONTEXT) beforeContext++;
    if (Math.max(sSim, vSim) >= DIRECT) afterDirect++;
    if (Math.max(sSim, vSim) >= CONTEXT) afterContext++;
    await new Promise((r) => setTimeout(r, 120)); // pacing embeddings
  }
  const n = sample.length || 1;
  console.log(`rata de potrivire pe ${sample.length} mesaje istorice (aceleași, înainte vs după):`);
  console.log(`  direct (≥0.85):  înainte ${beforeDirect}/${n} (${Math.round((beforeDirect * 100) / n)}%) → după ${afterDirect}/${n} (${Math.round((afterDirect * 100) / n)}%)`);
  console.log(`  context (≥0.65): înainte ${beforeContext}/${n} (${Math.round((beforeContext * 100) / n)}%) → după ${afterContext}/${n} (${Math.round((afterContext * 100) / n)}%)`);

  // ── 2) cap-coadă: enunț identic cu unul servibil ──────────────────────────
  const { data: servableIds } = await svc.from('exercise_servable').select('exercise_id, tier').eq('tier', 'verificat').limit(50);
  if (!servableIds?.length) fail('niciun exercițiu verificat servibil');
  const { data: exRows } = await svc
    .from('exercise_raw')
    .select('id, statement')
    .in('id', servableIds.map((s) => s.exercise_id))
    .not('embedding', 'is', null)
    .limit(1);
  const target = exRows?.[0];
  if (!target) fail('niciun exercițiu verificat cu embedding persistat');

  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);
  const cookies = buildAuthCookies(signIn.session);

  const t0 = new Date().toISOString();
  console.log(`\ntrimit enunțul identic (${target.id.slice(0, 8)}) prin /api/chat…`);
  const resp = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ message: target.statement, mode: 'study' }),
  });
  if (!resp.ok || !resp.body) fail(`/api/chat HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let source: string | null = null;
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.text) full += ev.text;
        if (ev.source) source = ev.source;
      } catch { /* parțial */ }
    }
  }
  if (source !== 'library') fail(`source=${source} (așteptat library) — biblioteca NU a răspuns prima`);
  if (!full.includes('Rezolvare verificată din bibliotecă')) fail('eticheta „Rezolvare verificată" lipsește');
  console.log('  ✓ răspuns din bibliotecă, cu eticheta „Rezolvare verificată"');

  await new Promise((r) => setTimeout(r, 2500));
  const { data: logRows } = await svc
    .from('api_usage_log')
    .select('task_name, endpoint, cost_usd')
    .eq('user_id', user.id)
    .gte('created_at', t0);
  const mainChat = (logRows ?? []).filter((r) => r.endpoint === '/api/chat');
  if (mainChat.length > 0) fail('ruta a făcut apel LLM principal (trebuia doar legătura)');
  const liaison = (logRows ?? []).filter((r) => r.endpoint === '/api/chat#liaison');
  const cost = liaison.reduce((a, r) => a + Number(r.cost_usd), 0);
  console.log(`  ✓ zero apeluri LLM de rezolvare; legătura narativă (Haiku): $${cost.toFixed(6)}`);
  console.log(`\n✅ D+E acceptate: biblioteca răspunde prima cu etichetă, costul apelului = $${cost.toFixed(6)} (vs $0.011 mesaj normal).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
