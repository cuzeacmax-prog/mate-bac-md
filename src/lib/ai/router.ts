import { streamText, generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";
import type { AiMessage, ModelConfig } from "./router.types";

const configCache = new Map<string, { config: ModelConfig; expires: number }>();

async function getModelConfig(taskName: string): Promise<ModelConfig> {
  const cached = configCache.get(taskName);
  if (cached && cached.expires > Date.now()) return cached.config;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from("ai_model_config")
    .select("task_name, provider, model_name, max_tokens, temperature, price_input_per_1m, price_output_per_1m, fallback_task_name")
    .eq("task_name", taskName)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error(`Model config not found for task: ${taskName}`);
  }

  configCache.set(taskName, { config: data as ModelConfig, expires: Date.now() + 60_000 });
  return data as ModelConfig;
}

function buildModel(config: ModelConfig) {
  switch (config.provider) {
    case "anthropic":
      return anthropic(config.model_name);
    case "google":
      return google(config.model_name);
    default:
      throw new Error(`Provider not supported: ${config.provider}`);
  }
}

export async function callAIStream(
  taskName: string,
  messages: AiMessage[],
  options?: { system?: string }
) {
  const config = await getModelConfig(taskName);
  const model = buildModel(config);

  return streamText({
    model,
    system: options?.system,
    messages,
    maxTokens: config.max_tokens || undefined,
    temperature: config.temperature,
  });
}

export async function callAI(
  taskName: string,
  messages: AiMessage[],
  options?: { system?: string }
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  const config = await getModelConfig(taskName);
  const model = buildModel(config);

  const result = await generateText({
    model,
    system: options?.system,
    messages,
    maxTokens: config.max_tokens || undefined,
    temperature: config.temperature,
  });

  return {
    text: result.text,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
  };
}

export async function getTaskPricing(
  taskName: string
): Promise<{ price_input_per_1m: number; price_output_per_1m: number; model_name: string }> {
  const config = await getModelConfig(taskName);
  return {
    price_input_per_1m: config.price_input_per_1m,
    price_output_per_1m: config.price_output_per_1m,
    model_name: config.model_name,
  };
}
