/**
 * ETAPA 75 FAZA 0 / FAZA H — măsurarea costurilor din api_usage_log.
 *
 * Agregă ultimele N zile (default 14): cost mediu per task/model, % cache per
 * rută, cost estimat per profil de elev. ACEEAȘI rulare la FAZA 0 (baseline)
 * și FAZA H (după) — diferența e doar snapshot-ul JSON scris.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa75-cost-baseline.ts
 *   SNAPSHOT=docs/etapa75-baseline.json npx tsx ... (scrie și snapshot)
 *
 * PROFILURILE DE ELEV — presupuneri de volum (documentate, nu măsurate):
 *  - ușor:  4 lecții/lună, 10 mesaje chat/lună, 8 evaluări daily, 4 TTS
 *  - mediu: 12 lecții/lună, 40 mesaje chat/lună, 24 evaluări daily, 12 TTS
 *  - intens: 30 lecții/lună, 150 mesaje chat/lună, 60 evaluări daily,
 *            1 simulare (9 evaluări), 30 TTS
 * Costurile per unitate vin din mediile MĂSURATE pe fereastra de N zile.
 */
import { writeFileSync } from 'node:fs';
import { createServiceClient } from '../../src/lib/supabase/service';

const DAYS = Number(process.env.DAYS ?? 14);

interface Row {
  task_name: string;
  model: string;
  endpoint: string;
  tokens_input: number;
  tokens_output: number;
  cached_input_tokens: number | null;
  cost_usd: number;
}

interface Agg {
  calls: number;
  avgIn: number;
  avgOut: number;
  avgCached: number;
  pctCallsCached: number;
  avgCost: number;
  totalCost: number;
}

function aggregate(rows: Row[]): Agg {
  const n = rows.length || 1;
  const sum = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    calls: rows.length,
    avgIn: Math.round(sum((r) => r.tokens_input) / n),
    avgOut: Math.round(sum((r) => r.tokens_output) / n),
    avgCached: Math.round(sum((r) => r.cached_input_tokens ?? 0) / n),
    pctCallsCached: Math.round((100 * rows.filter((r) => (r.cached_input_tokens ?? 0) > 0).length) / n),
    avgCost: sum((r) => r.cost_usd) / n,
    totalCost: sum((r) => r.cost_usd),
  };
}

export async function measureCosts() {
  const svc = createServiceClient();
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await svc
      .from('api_usage_log')
      .select('task_name, model, endpoint, tokens_input, tokens_output, cached_input_tokens, cost_usd')
      .gte('created_at', since)
      .order('created_at')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }

  // per task+model
  const byTask = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.task_name} | ${r.model}`;
    (byTask.get(k) ?? byTask.set(k, []).get(k)!).push(r);
  }
  // per endpoint (rutele cheie)
  const byRoute = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.endpoint} [${r.task_name}]`;
    (byRoute.get(k) ?? byRoute.set(k, []).get(k)!).push(r);
  }

  const taskAgg = Object.fromEntries([...byTask.entries()].map(([k, v]) => [k, aggregate(v)]));
  const routeAgg = Object.fromEntries([...byRoute.entries()].map(([k, v]) => [k, aggregate(v)]));

  // unități pentru profiluri (cost mediu măsurat; 0 dacă nu există în fereastră)
  const unit = (pred: (r: Row) => boolean): number => {
    const sel = rows.filter(pred);
    return sel.length ? sel.reduce((a, r) => a + r.cost_usd, 0) / sel.length : 0;
  };
  const u = {
    chatFreeMsg: unit((r) => r.endpoint === '/api/chat' && r.task_name === 'chat_free'),
    chatPremiumMsg: unit((r) => r.endpoint === '/api/chat' && r.task_name === 'chat_premium'),
    lessonServed: unit((r) => r.endpoint === '/api/lesson/start'),
    judge: unit((r) => r.task_name === 'judge_answer'),
    verify: unit((r) => r.task_name === 'verify_math'),
    summarize: unit((r) => r.task_name === 'summarize_history'),
    tts: unit((r) => r.task_name === 'tts'), // include hit-urile cu cost 0 → media reală per cerere
  };

  // profiluri (presupunerile din antet)
  const profile = (lessons: number, msgs: number, evals: number, tts: number, chatMsgCost: number) =>
    lessons * u.lessonServed + msgs * chatMsgCost + evals * u.judge + tts * u.tts + (msgs / 6) * u.summarize;
  const profiles = {
    'ușor (free)': profile(4, 10, 8, 4, u.chatFreeMsg),
    'mediu (free)': profile(12, 40, 24, 12, u.chatFreeMsg),
    'intens (free)': profile(30, 150, 69, 30, u.chatFreeMsg),
    'mediu (premium)': profile(12, 40, 24, 12, u.chatPremiumMsg),
    'intens (premium)': profile(30, 150, 69, 30, u.chatPremiumMsg),
  };

  return { since, days: DAYS, taskAgg, routeAgg, unit: u, profiles };
}

async function main() {
  const m = await measureCosts();
  console.log(`\n══ ETAPA 75 — costuri pe ultimele ${m.days} zile (din ${m.since.slice(0, 10)}) ══\n`);
  console.log('— per task | model —');
  for (const [k, a] of Object.entries(m.taskAgg)) {
    console.log(
      `  ${k.padEnd(48)} ${String(a.calls).padStart(4)} apeluri  in=${String(a.avgIn).padStart(5)}  out=${String(a.avgOut).padStart(5)}  cached=${String(a.avgCached).padStart(5)} (${a.pctCallsCached}% din apeluri)  avg=$${a.avgCost.toFixed(6)}  total=$${a.totalCost.toFixed(4)}`
    );
  }
  console.log('\n— per rută [task] —');
  for (const [k, a] of Object.entries(m.routeAgg)) {
    console.log(`  ${k.padEnd(44)} ${String(a.calls).padStart(4)} apeluri  avg=$${a.avgCost.toFixed(6)}  cache pe ${a.pctCallsCached}% din apeluri`);
  }
  console.log('\n— unități măsurate ($/apel) —');
  for (const [k, v] of Object.entries(m.unit)) console.log(`  ${k.padEnd(18)} $${v.toFixed(6)}`);
  console.log('\n— cost estimat per profil de elev ($/lună, presupunerile din antet) —');
  for (const [k, v] of Object.entries(m.profiles)) console.log(`  ${k.padEnd(18)} $${v.toFixed(4)}`);

  const snapshot = process.env.SNAPSHOT;
  if (snapshot) {
    writeFileSync(snapshot, JSON.stringify(m, null, 2));
    console.log(`\nsnapshot scris: ${snapshot}`);
  }
}
if (process.argv[1]?.includes('etapa75-cost-baseline')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
