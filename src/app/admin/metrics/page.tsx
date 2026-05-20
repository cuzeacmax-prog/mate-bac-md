import { createClient } from "@/lib/supabase/server";

type UsageRow = {
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number | null;
  created_at: string;
};

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

  const [
    { data: allUsage },
    { data: monthUsage },
    { data: conversations },
    { data: usersToday },
    { data: usersMonth },
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

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Metrici</h1>

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
