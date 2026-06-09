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
