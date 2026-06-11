export interface ModelConfig {
  task_name: string;
  provider: "anthropic" | "google" | "openai";
  model_name: string;
  max_tokens: number;
  temperature: number;
  price_input_per_1m: number;
  price_output_per_1m: number;
  fallback_task_name: string | null;
}

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
  /**
   * ETAPA 75 FAZA A: breakpoint de cache PE MESAJ (cache incremental al
   * conversației) — se pune pe ULTIMUL mesaj din istoricul anterior: prefixul
   * system+istoric crește turn cu turn și se recitește din cache. Necesar pe
   * Haiku, unde minimul cacheabil e 4096 tokeni (system-ul singur nu ajunge
   * întotdeauna); pe Sonnet (minim 1024) aduce istoricul în cache, nu doar
   * system-ul.
   */
  cache?: boolean;
}

/**
 * ETAPA 66 FAZA B: bloc de system prompt cu opțiune de cache Anthropic.
 * Ordinea blocurilor = prefixul promptului; blocurile cache:true devin
 * breakpoint-uri cache_control ephemeral (max 4, validate de provider).
 * Regulă: tot ce variază per-mesaj stă DUPĂ blocurile cache-uite.
 */
export interface SystemBlock {
  text: string;
  cache?: boolean;
}
