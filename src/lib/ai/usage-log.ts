/**
 * usage-log.ts — ETAPA 66 FAZA A: logarea centralizată a fiecărui apel
 * LLM / TTS / embedding în api_usage_log, cu cifre din răspunsurile API
 * (tokens, cache, latență) — niciodată estimate.
 *
 * Best-effort: logarea nu are voie să strice apelul principal (erorile se
 * înghit cu console.error).
 */
import { createServiceClient } from '@/lib/supabase/service';

export interface ApiUsageEntry {
  userId?: string | null;
  taskName: string;
  model: string;
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number | null;
  latencyMsTotal?: number | null;
  latencyMsTtfb?: number | null;
  costUsd: number;
}

export async function logApiUsage(entry: ApiUsageEntry): Promise<void> {
  try {
    const service = createServiceClient();
    const { error } = await service.from('api_usage_log').insert({
      user_id: entry.userId ?? null,
      task_name: entry.taskName,
      model: entry.model,
      endpoint: entry.endpoint,
      tokens_input: Math.round(entry.inputTokens),
      tokens_output: Math.round(entry.outputTokens),
      cached_input_tokens: entry.cachedInputTokens ?? null,
      latency_ms_total: entry.latencyMsTotal ?? null,
      latency_ms_ttfb: entry.latencyMsTtfb ?? null,
      cost_usd: entry.costUsd,
    });
    if (error) console.error('[usage-log] insert failed:', error.message);
  } catch (err) {
    console.error('[usage-log] threw:', err instanceof Error ? err.message : err);
  }
}

/**
 * Costul Anthropic cu cache: tokenii citiți din cache costă 10% din preț,
 * scrierea în cache 125% (TTL 5m). Pentru provideri fără cache, cached*=0.
 */
export function computeLlmCost(params: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  priceInputPer1M: number;
  priceOutputPer1M: number;
}): number {
  const {
    inputTokens, outputTokens,
    cacheReadTokens = 0, cacheWriteTokens = 0,
    priceInputPer1M, priceOutputPer1M,
  } = params;
  // inputTokens din SDK = tokenii NEcache-uiți + cei cache-uiți sunt raportați separat
  const freshInput = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);
  return (
    (freshInput / 1_000_000) * priceInputPer1M +
    (cacheReadTokens / 1_000_000) * priceInputPer1M * 0.1 +
    (cacheWriteTokens / 1_000_000) * priceInputPer1M * 1.25 +
    (outputTokens / 1_000_000) * priceOutputPer1M
  );
}
