import { createClient } from "@/lib/supabase/server";

type UsageRow = {
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number | null;
  created_at: string;
};

// ETAPA 66 F2: rândurile ferestrei de 14 zile, cu câmpurile instrumentate
type WindowRow = UsageRow & {
  user_id: string | null;
  task_name: string | null;
  cached_input_tokens: number | null;
  latency_ms_ttfb: number | null;
  latency_ms_total: number | null;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

type ConvTitle = {
  title: string | null;
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("ro-MD", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default async function AdminMetricsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const window14 = new Date(now.getTime() - 14 * 86_400_000).toISOString();

  const [
    { data: allUsage },
    { data: monthUsage },
    { data: conversations },
    { data: usersToday },
    { data: usersMonth },
    { data: windowUsage },
    { data: alertConfig },
  ] = await Promise.all([
    supabase
      .from("api_usage_log")
      .select("model, tokens_input, tokens_output, cost_usd, created_at"),
    supabase
      .from("api_usage_log")
      .select("model, tokens_input, tokens_output, cost_usd")
      .gte("created_at", monthStart),
    supabase
      .from("conversations")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("api_usage_log")
      .select("user_id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase
      .from("api_usage_log")
      .select("user_id", { count: "exact", head: true })
      .gte("created_at", monthStart),
    // ETAPA 66 F2: fereastra de 14 zile cu câmpurile instrumentate (FAZA A)
    supabase
      .from("api_usage_log")
      .select("user_id, task_name, model, tokens_input, tokens_output, cost_usd, cached_input_tokens, latency_ms_ttfb, latency_ms_total, created_at")
      .gte("created_at", window14)
      .limit(20000),
    supabase
      .from("system_config")
      .select("key, value")
      .in("key", ["cost_alert_daily_usd", "cost_alert_last"]),
  ]);

  const all = (allUsage ?? []) as UsageRow[];
  const month = (monthUsage ?? []) as UsageRow[];
  const convTitles = (conversations ?? []) as ConvTitle[];

  const totalCost = all.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const monthCost = month.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const totalTokensIn = all.reduce((s, r) => s + r.tokens_input, 0);
  const totalTokensOut = all.reduce((s, r) => s + r.tokens_output, 0);
  const monthTokensIn = month.reduce((s, r) => s + r.tokens_input, 0);
  const monthTokensOut = month.reduce((s, r) => s + r.tokens_output, 0);

  // Top titluri conversații (freq count)
  const titleFreq: Record<string, number> = {};
  for (const c of convTitles) {
    const t = c.title?.trim() ?? "(fără titlu)";
    titleFreq[t] = (titleFreq[t] ?? 0) + 1;
  }
  const topTitles = Object.entries(titleFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // ── ETAPA 66 F2: agregatele ferestrei de 14 zile ──────────────────────────
  const win = (windowUsage ?? []) as WindowRow[];
  const byDay = new Map<string, { cost: number; tokIn: number; tokOut: number; calls: number }>();
  const byUser = new Map<string, number>();
  const chatTtfb: number[] = [];
  const chatTotal: number[] = [];
  let chatInput = 0;
  let chatCached = 0;
  let ttsCalls = 0;
  let ttsHits = 0;
  for (const r of win) {
    const day = r.created_at.slice(0, 10);
    const d = byDay.get(day) ?? { cost: 0, tokIn: 0, tokOut: 0, calls: 0 };
    d.cost += Number(r.cost_usd ?? 0);
    d.tokIn += r.tokens_input ?? 0;
    d.tokOut += r.tokens_output ?? 0;
    d.calls++;
    byDay.set(day, d);
    if (r.created_at >= monthStart && r.user_id) {
      byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + Number(r.cost_usd ?? 0));
    }
    if (r.task_name?.startsWith("chat_")) {
      if (r.latency_ms_ttfb != null) chatTtfb.push(r.latency_ms_ttfb);
      if (r.latency_ms_total != null) chatTotal.push(r.latency_ms_total);
      chatInput += r.tokens_input ?? 0;
      chatCached += r.cached_input_tokens ?? 0;
    }
    if (r.task_name === "tts") {
      ttsCalls++;
      if (r.model === "tts-cache") ttsHits++;
    }
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const topUsers = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  chatTtfb.sort((a, b) => a - b);
  chatTotal.sort((a, b) => a - b);
  const promptCacheRate = chatInput > 0 ? (chatCached / chatInput) * 100 : 0;
  const ttsHitRate = ttsCalls > 0 ? (ttsHits / ttsCalls) * 100 : 0;

  const alertRows = (alertConfig ?? []) as Array<{ key: string; value: unknown }>;
  const alertThreshold = Number(alertRows.find((r) => r.key === "cost_alert_daily_usd")?.value ?? 0);
  const lastAlert = alertRows.find((r) => r.key === "cost_alert_last")?.value as
    | { date?: string; cost_usd?: number; threshold?: number }
    | undefined;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCost = byDay.get(todayKey)?.cost ?? 0;
  const alertActive = alertThreshold > 0 && todayCost > alertThreshold;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Metrici</h1>

      {/* ETAPA 66 F3: marcaj vizibil când costul zilei depășește pragul */}
      {(alertActive || lastAlert?.date === todayKey) && (
        <div className="mb-6 rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800 font-medium">
          ⚠ ALERTĂ COST: azi ${fmt(todayCost, 2)} {alertThreshold > 0 && `(prag $${fmt(alertThreshold, 2)})`}
          {lastAlert?.date && lastAlert.date !== todayKey && ` · ultimul prag depășit: ${lastAlert.date}`}
        </div>
      )}

      {/* ETAPA 66 F2: latență + rate cache (7-14 zile) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="TTFB chat p50 / p95 (14z)" value={`${percentile(chatTtfb, 50) ?? "—"} / ${percentile(chatTtfb, 95) ?? "—"} ms`} />
        <MetricCard label="Latență totală p50 / p95" value={`${percentile(chatTotal, 50) ?? "—"} / ${percentile(chatTotal, 95) ?? "—"} ms`} />
        <MetricCard label="Prompt cache (input chat)" value={`${fmt(promptCacheRate, 1)}%`} />
        <MetricCard label="TTS cache hit" value={ttsCalls > 0 ? `${fmt(ttsHitRate, 1)}%` : "—"} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Cost total (all time)"
          value={`$${fmt(totalCost, 4)}`}
        />
        <MetricCard
          label="Cost luna aceasta"
          value={`$${fmt(monthCost, 4)}`}
        />
        <MetricCard
          label="Useri activi azi"
          value={String(usersToday?.length ?? 0)}
        />
        <MetricCard
          label="Useri activi luna"
          value={String(usersMonth?.length ?? 0)}
        />
      </div>

      {/* Tokens */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Tokens all time</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Input</dt>
              <dd className="font-mono">{fmt(totalTokensIn, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Output</dt>
              <dd className="font-mono">{fmt(totalTokensOut, 0)}</dd>
            </div>
          </dl>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Tokens luna aceasta</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Input</dt>
              <dd className="font-mono">{fmt(monthTokensIn, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Output</dt>
              <dd className="font-mono">{fmt(monthTokensOut, 0)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ETAPA 66 F2: cost/tokens pe zi (14 zile) + top useri pe cost (luna) */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">Cost & tokens pe zi (14 zile)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Zi</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Cost</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Tokens in/out</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Apeluri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {days.map(([day, d]) => (
                <tr key={day}>
                  <td className="px-4 py-1.5 text-gray-700">{day}</td>
                  <td className="px-4 py-1.5 text-right font-mono">${fmt(d.cost, 3)}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-gray-500">{fmt(d.tokIn, 0)} / {fmt(d.tokOut, 0)}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-gray-500">{d.calls}</td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Fără date în fereastră.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">Top 10 useri după cost (luna aceasta)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">User</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topUsers.map(([uid, cost]) => (
                <tr key={uid}>
                  <td className="px-4 py-1.5 font-mono text-gray-700">{uid.slice(0, 8)}…</td>
                  <td className="px-4 py-1.5 text-right font-mono">${fmt(cost, 4)}</td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Fără date luna aceasta.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top întrebări */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">
            Top 10 subiecte (după titlul conversației)
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">#</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Titlu</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Conversații</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {topTitles.map(([title, count], i) => (
              <tr key={title} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2 text-gray-900 max-w-md truncate">{title}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-700">{count}</td>
              </tr>
            ))}
            {topTitles.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  Nicio conversație înregistrată.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
