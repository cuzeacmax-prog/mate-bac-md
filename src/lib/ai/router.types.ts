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
