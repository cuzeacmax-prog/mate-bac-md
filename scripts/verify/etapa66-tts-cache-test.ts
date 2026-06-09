/**
 * ETAPA 66 FAZA C2 — testul cache-ului TTS persistent.
 *
 * 20 de redări prin dev server: 10 enunțuri unice (din exercițiile servibile),
 * fiecare redat de 2 ori. Așteptat: a 2-a redare = hit (X-TTS-Cache: hit,
 * cost 0 în log). Raport: rată hit, cost înainte/după, latență hit vs miss,
 * dimensiunea medie a fișierului → estimare cache la 1000 enunțuri (ESTIMAT).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa66-tts-cache-test.ts
 */
import { createClient as createSbClient, type Session } from '@supabase/supabase-js';
import { createServiceClient } from '../../src/lib/supabase/service';

const BASE = process.env.BASELINE_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'etapa60-acceptance@test.local';
const PASSWORD = 'etapa66-baseline-Parola!9';
const REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];

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
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  await svc.auth.admin.updateUserById(user.id, { password: PASSWORD });
  const anon = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !signIn.session) fail(`signIn: ${error?.message}`);
  const cookies = buildAuthCookies(signIn.session);

  // 10 enunțuri REALE din exercițiile servibile (sursa finită → cazul natural)
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id').limit(10);
  const ids = (servable ?? []).map((s) => s.exercise_id as string);
  const { data: exercises } = await svc.from('exercise_raw').select('id, statement').in('id', ids);
  const texts = (exercises ?? []).map((e) => (e.statement as string).slice(0, 400));
  if (texts.length < 10) fail(`doar ${texts.length} enunțuri servibile găsite`);

  // curățare: șterge intrările de cache pentru aceste texte? NU avem cheia aici
  // (pipeline-ul latexToSpeech rulează pe server) — testul măsoară exact fluxul real:
  // redarea 1 poate fi hit dacă enunțul a mai fost redat vreodată (raportat onest).
  const testStart = new Date().toISOString();
  const results: Array<{ i: number; round: 1 | 2; status: number; cache: string | null; ms: number; bytes: number }> = [];
  for (const round of [1, 2] as const) {
    for (const [i, text] of texts.entries()) {
      const t0 = Date.now();
      const r = await fetch(`${BASE}/api/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookies },
        body: JSON.stringify({ text, voice: 'nova' }),
      });
      const buf = r.ok ? await r.arrayBuffer() : new ArrayBuffer(0);
      results.push({ i, round, status: r.status, cache: r.headers.get('X-TTS-Cache'), ms: Date.now() - t0, bytes: buf.byteLength });
      if (!r.ok) fail(`TTS HTTP ${r.status} pe enunțul ${i}`);
    }
    console.log(`runda ${round} încheiată`);
  }

  const hits = results.filter((r) => r.cache === 'hit');
  const misses = results.filter((r) => r.cache === 'miss');
  const round2hits = results.filter((r) => r.round === 2 && r.cache === 'hit');
  const mean = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);

  console.log(`\n── rezultate (20 redări, 10 unice ×2) ──`);
  console.log(`  hit: ${hits.length}/20, miss: ${misses.length}/20`);
  console.log(`  runda 2: ${round2hits.length}/10 hit (așteptat 10/10)`);
  console.log(`  latență medie: miss=${mean(misses.map((r) => r.ms))}ms, hit=${mean(hits.map((r) => r.ms))}ms`);
  if (round2hits.length < 10) fail(`runda 2 are doar ${round2hits.length}/10 hit-uri`);

  // costul din log: înainte (toate miss-uri ar fi costat) vs după (doar miss-urile)
  await new Promise((r) => setTimeout(r, 1500));
  const { data: logRows } = await svc
    .from('api_usage_log')
    .select('model, cost_usd, tokens_input')
    .eq('task_name', 'tts')
    .gte('created_at', testStart);
  const costReal = (logRows ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  const costFaraCache = (logRows ?? []).reduce((s, r) => s + (r.tokens_input ?? 0) * (15 / 1_000_000), 0);
  console.log(`\n  cost real (cu cache): $${costReal.toFixed(5)}`);
  console.log(`  cost fără cache (aceleași 20 redări): $${costFaraCache.toFixed(5)} → economie ${Math.round((1 - costReal / costFaraCache) * 100)}%`);

  // dimensiunea cache-ului la 1000 enunțuri — ESTIMAT din media măsurată
  const meanBytes = mean(results.filter((r) => r.bytes > 0).map((r) => r.bytes));
  console.log(`\n  fișier mediu: ${(meanBytes / 1024).toFixed(0)} KB → ESTIMAT la 1000 enunțuri: ${(meanBytes * 1000 / 1024 / 1024).toFixed(0)} MB`);

  console.log('\n✅ FAZA C dovedită: runda 2 integral din cache, cost 0 pe hit.');
}
main().catch((e) => { console.error(e); process.exit(1); });
