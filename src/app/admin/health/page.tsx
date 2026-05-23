import { createServiceClient } from '@/lib/supabase/service';

interface Check {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
}

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  const service = createServiceClient();

  // 1. solved_exercises count
  try {
    const { count, error } = await service.from('solved_exercises').select('id', { count: 'exact', head: true });
    if (error) throw error;
    checks.push({ name: 'Library: solved_exercises', status: (count ?? 0) > 0 ? 'ok' : 'warn', detail: `${count ?? 0} exerciții stocate` });
  } catch (e) {
    checks.push({ name: 'Library: solved_exercises', status: 'error', detail: e instanceof Error ? e.message : String(e) });
  }

  // 2. tikz_templates count
  try {
    const { count, error } = await service.from('tikz_templates').select('id', { count: 'exact', head: true });
    if (error) throw error;
    checks.push({ name: 'Library: tikz_templates', status: 'ok', detail: `${count ?? 0} template-uri` });
  } catch (e) {
    checks.push({ name: 'Library: tikz_templates', status: 'error', detail: e instanceof Error ? e.message : String(e) });
  }

  // 3. gap_analysis count
  try {
    const { count, error } = await service.from('gap_analysis').select('id', { count: 'exact', head: true });
    if (error) throw error;
    checks.push({ name: 'Gap analysis: întrebări neacoperite', status: 'ok', detail: `${count ?? 0} interogări fără match` });
  } catch (e) {
    checks.push({ name: 'Gap analysis', status: 'error', detail: e instanceof Error ? e.message : String(e) });
  }

  // 4. needs_review count
  try {
    const { count, error } = await service.from('solved_exercises').select('id', { count: 'exact', head: true }).eq('needs_review', true);
    if (error) throw error;
    checks.push({ name: 'Library: necesită review', status: (count ?? 0) > 0 ? 'warn' : 'ok', detail: `${count ?? 0} exerciții neverificate` });
  } catch (e) {
    checks.push({ name: 'Library: review queue', status: 'error', detail: e instanceof Error ? e.message : String(e) });
  }

  // 5. Railway TikZ service
  try {
    const tikzUrl = process.env.TIKZ_COMPILE_URL;
    if (!tikzUrl) throw new Error('TIKZ_COMPILE_URL not set');
    const healthUrl = tikzUrl.replace('/compile', '/health').replace(/\/compile$/, '/health');
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
    checks.push({ name: 'Railway: TikZ compiler', status: res.ok ? 'ok' : 'warn', detail: `HTTP ${res.status}` });
  } catch (e) {
    checks.push({ name: 'Railway: TikZ compiler', status: 'error', detail: e instanceof Error ? e.message : String(e) });
  }

  // 6. Gemini key present
  checks.push({
    name: 'Gemini API key',
    status: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'ok' : 'error',
    detail: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'Configurată' : 'GOOGLE_GENERATIVE_AI_API_KEY lipsă',
  });

  // 7. match_exercises RPC exists
  try {
    const { error } = await service.rpc('match_exercises', {
      query_embedding: Array(1536).fill(0),
      match_threshold: 0.99,
      match_count: 1,
    });
    const rpcMissing = error?.code === '42883';
    checks.push({
      name: 'DB: match_exercises RPC',
      status: rpcMissing ? 'error' : 'ok',
      detail: rpcMissing ? 'Funcție lipsă — aplică migrarea 20260602100000' : 'Funcție disponibilă',
    });
  } catch (e) {
    checks.push({ name: 'DB: match_exercises RPC', status: 'warn', detail: e instanceof Error ? e.message : String(e) });
  }

  return checks;
}

const STATUS_STYLES = {
  ok: 'bg-green-50 border-green-200 text-green-800',
  warn: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  error: 'bg-red-50 border-red-200 text-red-800',
};

const STATUS_ICONS = { ok: '✅', warn: '⚠️', error: '❌' };

export const revalidate = 0;

export default async function HealthPage() {
  const checks = await runChecks();
  const allOk = checks.every((c) => c.status === 'ok');
  const hasErrors = checks.some((c) => c.status === 'error');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${allOk ? 'bg-green-100 text-green-800' : hasErrors ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {allOk ? 'Toate OK' : hasErrors ? 'Erori detectate' : 'Avertismente'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {checks.map((check) => (
          <div
            key={check.name}
            className={`flex items-center justify-between p-4 border rounded-lg ${STATUS_STYLES[check.status]}`}
          >
            <div className="flex items-center gap-3">
              <span>{STATUS_ICONS[check.status]}</span>
              <span className="font-medium">{check.name}</span>
            </div>
            <span className="text-sm opacity-80">{check.detail}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Generat la: {new Date().toLocaleString('ro-MD', { timeZone: 'Europe/Chisinau' })} — reîmprospătare la fiecare request
      </p>
    </div>
  );
}
