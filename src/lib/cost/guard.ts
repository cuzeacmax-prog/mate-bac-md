/**
 * guard.ts — ETAPA 66 FAZA F1: gardurile de cost.
 *
 *  - kill-switch global (system_config.llm_kill_switch): incident de cost →
 *    chat-ul răspunde 503 cu mesaj politicos, NU tăcere.
 *  - buget lunar per tier (system_config.cost_budget_usd): depășire →
 *    downgrade temporar la Haiku (task chat_free) + notă politicoasă în mesaj.
 *    Adminii sunt exceptați. Costul lunar vine din api_usage_log (month_cost).
 * Config cache-uit în proces 60s (ca în router).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

interface GuardConfig {
  budgets: Record<string, number>;
  killSwitch: boolean;
}

let cache: { config: GuardConfig; expires: number } | null = null;

async function getGuardConfig(service: SupabaseClient): Promise<GuardConfig> {
  if (cache && cache.expires > Date.now()) return cache.config;
  const { data, error } = await service
    .from('system_config')
    .select('key, value')
    .in('key', ['cost_budget_usd', 'llm_kill_switch']);
  if (error) {
    console.error('[cost/guard] config read failed:', error.message);
    return { budgets: {}, killSwitch: false }; // fail-open: gardul nu blochează produsul
  }
  const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  const config: GuardConfig = {
    budgets: (byKey.get('cost_budget_usd') as Record<string, number> | undefined) ?? {},
    killSwitch: byKey.get('llm_kill_switch') === true,
  };
  cache = { config, expires: Date.now() + 60_000 };
  return config;
}

export const KILL_SWITCH_MESSAGE =
  'Asistentul e oprit temporar pentru mentenanță. Revino în scurt timp — progresul tău e salvat.';

export const BUDGET_NOTICE =
  '_Notă: ai folosit intens asistentul luna aceasta, așa că răspund pe modelul rapid până la resetarea lunară. Calitatea explicațiilor rămâne prioritară._\n\n';

export interface CostGuardVerdict {
  /** false = kill-switch activ — nu se face niciun apel LLM */
  allowed: boolean;
  /** task-ul efectiv (downgrade la chat_free peste buget) */
  effectiveTask: string;
  /** notă politicoasă de prefixat în răspuns (downgrade), dacă există */
  notice: string | null;
}

/**
 * F3: dacă costul de azi depășește pragul (cost_alert_daily_usd), persistă un
 * marcaj o dată pe zi în system_config ('cost_alert_last') — afișat vizibil
 * în /admin/metrics. (admin_feedback are CHECK pe rating + FK spre messages —
 * nepotrivit ca sink de alertă; spec permite marcajul vizibil în admin.)
 */
export async function maybeWriteDailyCostAlert(service: SupabaseClient): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: cfg } = await service
      .from('system_config')
      .select('key, value')
      .in('key', ['cost_alert_daily_usd', 'cost_alert_last']);
    const byKey = new Map((cfg ?? []).map((r) => [r.key as string, r.value]));
    const threshold = Number(byKey.get('cost_alert_daily_usd') ?? 0);
    if (!threshold) return;
    const last = byKey.get('cost_alert_last') as { date?: string } | undefined;
    if (last?.date === today) return; // deja marcat azi

    const { data: rows } = await service
      .from('api_usage_log')
      .select('cost_usd')
      .gte('created_at', `${today}T00:00:00Z`);
    const todayCost = (rows ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    if (todayCost <= threshold) return;

    await service.from('system_config').upsert(
      {
        key: 'cost_alert_last',
        value: { date: today, cost_usd: +todayCost.toFixed(4), threshold },
        description: 'ETAPA 66 F3: ultimul prag de cost zilnic depășit (marcaj afișat în /admin/metrics).',
      },
      { onConflict: 'key' }
    );
    console.error(`[cost/guard] ALERTĂ: costul zilei $${todayCost.toFixed(2)} > prag $${threshold}`);
  } catch (err) {
    console.error('[cost/guard] daily alert failed:', err instanceof Error ? err.message : err);
  }
}

export async function checkCostGuard(
  service: SupabaseClient,
  userId: string,
  taskName: string,
  subscriptionStatus: string
): Promise<CostGuardVerdict> {
  const config = await getGuardConfig(service);
  if (config.killSwitch) {
    return { allowed: false, effectiveTask: taskName, notice: KILL_SWITCH_MESSAGE };
  }
  if (subscriptionStatus === 'admin') {
    return { allowed: true, effectiveTask: taskName, notice: null };
  }
  const tierKey = subscriptionStatus.startsWith('family') ? 'family' : subscriptionStatus;
  const budget = config.budgets[tierKey];
  if (typeof budget !== 'number' || budget <= 0) {
    return { allowed: true, effectiveTask: taskName, notice: null };
  }
  try {
    const { data: spent, error } = await service.rpc('month_cost', { p_user_id: userId });
    if (error) throw error;
    if (Number(spent) >= budget) {
      const downgrade = taskName !== 'chat_free';
      return {
        allowed: true,
        effectiveTask: 'chat_free',
        notice: downgrade ? BUDGET_NOTICE : null,
      };
    }
  } catch (err) {
    console.error('[cost/guard] month_cost failed (fail-open):', err instanceof Error ? err.message : err);
  }
  return { allowed: true, effectiveTask: taskName, notice: null };
}
