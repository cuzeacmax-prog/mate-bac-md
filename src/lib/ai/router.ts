import { streamText, generateText, stepCountIs, type ToolSet } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createServiceClient } from "@/lib/supabase/service";
import { logApiUsage, computeLlmCost } from "./usage-log";
import type { AiMessage, ModelConfig } from "./router.types";

const configCache = new Map<string, { config: ModelConfig; expires: number }>();

async function getModelConfig(taskName: string): Promise<ModelConfig> {
  const cached = configCache.get(taskName);
  if (cached && cached.expires > Date.now()) return cached.config;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_model_config")
    .select("task_name, provider, model_name, max_tokens, temperature, price_input_per_1m, price_output_per_1m, fallback_task_name")
    .eq("task_name", taskName)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    console.error("[AI Router] getModelConfig failed:", { taskName, errorMessage: error?.message, errorCode: error?.code });
    throw new Error(`Model config not found for task: ${taskName}${error ? ` (${error.message})` : ""}`);
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
    maxOutputTokens: config.max_tokens || undefined,
    temperature: config.temperature,
  });
}

export async function callAI(
  taskName: string,
  messages: AiMessage[],
  options?: { system?: string; userId?: string | null; endpoint?: string }
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const config = await getModelConfig(taskName);
  const model = buildModel(config);

  const start = Date.now();
  const result = await generateText({
    model,
    system: options?.system,
    messages,
    maxOutputTokens: config.max_tokens || undefined,
    temperature: config.temperature,
  });
  const latencyMs = Date.now() - start;

  // ETAPA 66 FAZA A: fiecare apel non-stream se loghează aici, central —
  // cifrele vin din usage-ul răspunsului API, nu sunt estimate.
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const cacheRead = result.usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWrite = result.usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  void logApiUsage({
    userId: options?.userId ?? null,
    taskName,
    model: config.model_name,
    endpoint: options?.endpoint ?? `task:${taskName}`,
    inputTokens,
    outputTokens,
    cachedInputTokens: cacheRead,
    latencyMsTotal: latencyMs,
    costUsd: computeLlmCost({
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      priceInputPer1M: config.price_input_per_1m,
      priceOutputPer1M: config.price_output_per_1m,
    }),
  });

  return {
    text: result.text,
    inputTokens,
    outputTokens,
  };
}

/**
 * callAIStream cu Tool Use support (Vercel AI SDK v6).
 * Activează tool-calling loop (maxim 4 steps) când tools e furnizat.
 * Altfel, comportament identic cu callAIStream.
 */
export async function callAIStreamWithTools<T extends ToolSet>(
  taskName: string,
  messages: AiMessage[],
  options: { system?: string; tools?: T; maxToolSteps?: number }
) {
  const config = await getModelConfig(taskName);
  const model = buildModel(config);

  return streamText({
    model,
    system: options.system,
    messages,
    maxOutputTokens: config.max_tokens || undefined,
    temperature: config.temperature,
    tools: options.tools && Object.keys(options.tools).length > 0 ? options.tools : undefined,
    stopWhen: options.tools && Object.keys(options.tools).length > 0
      ? stepCountIs(options.maxToolSteps ?? 4)
      : undefined,
  });
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
