import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SYSTEM_PROMPT_V1 } from "@/lib/ai/system-prompt";
import { callAIStream, getTaskPricing } from "@/lib/ai/router";
import { generateEmbeddingForQuery } from "@/lib/embeddings/gemini";

const FREE_MONTHLY_LIMIT = 30;
const IS_DEV = process.env.NODE_ENV === "development";

const RAG_DIRECT_THRESHOLD = 0.85;
const RAG_CONTEXT_THRESHOLD = 0.65;
const METHOD_THRESHOLD = 0.55;

interface RagMatch {
  id: string;
  statement: string;
  solution: string;
  topic: string;
  subtopic: string;
  similarity: number;
  svg_static: string | null;
  tags: string[];
}

interface MethodMatch {
  id: string;
  exercise_type: string;
  exercise_type_label: string;
  method_name: string;
  description: string | null;
  steps: Array<{ step: number; title: string; content?: string; formula?: string }>;
  notation_rules: Record<string, string>;
  examples: unknown[];
  common_mistakes: Array<{ mistake: string; correction: string }>;
  grade_level: number;
  topic: string;
  importance_score: number;
  similarity: number;
}

function serverError(label: string, err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[chat/route] ${label}:`, err instanceof Error ? err.stack : err);
  return NextResponse.json(
    { error: IS_DEV ? `${label}: ${msg}` : "Eroare internă. Încearcă din nou." },
    { status: 500 }
  );
}

async function lookupLibrary(message: string): Promise<{ match: RagMatch | null; embedding: number[] | null }> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return { match: null, embedding: null };
  try {
    const embedding = await generateEmbeddingForQuery(message);
    const service = createServiceClient();
    const { data } = await service.rpc("match_exercises", {
      query_embedding: embedding,
      match_threshold: RAG_CONTEXT_THRESHOLD,
      match_count: 1,
    });
    const match = data && data.length > 0 ? (data[0] as RagMatch) : null;
    return { match, embedding };
  } catch {
    return { match: null, embedding: null };
  }
}

/**
 * Caută cea mai relevantă metodă de rezolvare BAC MD.
 * Non-blocking — returnează null dacă tabela nu există sau dacă embedding-ul e null.
 * Backwards-compat: fallback transparent dacă solution_methods nu e populat.
 */
async function findRelevantMethod(embedding: number[] | null): Promise<MethodMatch | null> {
  if (!embedding) return null;
  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc("match_solution_methods", {
      query_embedding: embedding,
      match_threshold: METHOD_THRESHOLD,
      match_count: 1,
    });
    if (error) {
      // Tabela poate să nu existe încă (înainte de migrare) — nu logăm ca eroare
      if (error.message?.includes("does not exist") || error.message?.includes("function")) {
        return null;
      }
      console.warn("[chat/route] match_solution_methods warning:", error.message);
      return null;
    }
    return data && data.length > 0 ? (data[0] as MethodMatch) : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log("[chat/route] POST started");

  // ── Auth ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────
  let body: { message: string; conversationId?: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error("[chat/route] body parse failed:", err);
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  const { message, conversationId } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mesaj gol" }, { status: 400 });
  }

  // ── Profile + tier check ────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (profileErr) {
    return serverError("profile fetch", profileErr);
  }

  const status: string = profile?.subscription_status ?? "free";
  const isPremium =
    status === "premium" || status.startsWith("family") || status === "admin";

  // ── Task name based on tier ─────────────────────────────────────
  const taskName =
    status === "admin" ? "chat_admin"
    : status === "premium" || status.startsWith("family") ? "chat_premium"
    : "chat_free";

  // ── Rate limit check ────────────────────────────────────────────
  if (!isPremium) {
    let allowed: boolean | null = null;
    try {
      const { data, error: rpcErr } = await supabase.rpc("check_rate_limit", {
        p_user_id: user.id,
        p_action_type: "message",
      });
      if (rpcErr) throw rpcErr;
      allowed = data as boolean;
    } catch (err) {
      console.error("[chat/route] check_rate_limit threw:", err instanceof Error ? err.stack : err);
      allowed = true; // fail-open
    }

    if (allowed === false) {
      return NextResponse.json(
        { error: "RATE_LIMIT_EXCEEDED", limit: FREE_MONTHLY_LIMIT },
        { status: 429 }
      );
    }
  }

  // ── RAG library lookup (Gemini free tier — non-blocking) ────────
  const { match: ragMatch, embedding: queryEmbedding } = await lookupLibrary(message);
  const isDirectMatch = ragMatch !== null && ragMatch.similarity >= RAG_DIRECT_THRESHOLD;
  const isContextMatch = ragMatch !== null && ragMatch.similarity >= RAG_CONTEXT_THRESHOLD && !isDirectMatch;

  // ── Metodă de rezolvare BAC MD (backwards-compat — null dacă tabela nu există) ──
  const methodMatch = await findRelevantMethod(queryEmbedding);

  // ── Conversation create or load ─────────────────────────────────
  let convId: string = conversationId ?? "";
  if (!convId) {
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: message.slice(0, 60) })
      .select("id")
      .single();

    if (convErr || !conv) {
      return serverError("conversations insert", convErr ?? new Error("no data returned"));
    }
    convId = conv.id as string;
  }

  // ── Load history ────────────────────────────────────────────────
  const { data: history, error: historyErr } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);

  if (historyErr) {
    console.error("[chat/route] history fetch error:", historyErr);
  }

  const priorMessages = (
    (history as { role: string; content: string | null }[] | null) ?? []
  )
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));

  // ── Save user message ───────────────────────────────────────────
  const { error: userMsgErr } = await supabase.from("messages").insert({
    conversation_id: convId,
    role: "user",
    content: message,
  });

  if (userMsgErr) {
    return serverError("user message insert", userMsgErr);
  }

  // ── System prompt — inject RAG context + metodă BAC MD ──────────
  let systemPrompt = SYSTEM_PROMPT_V1;

  // Injectează metoda de rezolvare dacă există
  if (methodMatch) {
    const stepsText = methodMatch.steps
      .map(s => {
        let line = `  ${s.step}. ${s.title}`;
        if (s.content) line += `: ${s.content}`;
        if (s.formula) line += ` [${s.formula}]`;
        return line;
      })
      .join('\n');

    const notationText = Object.entries(methodMatch.notation_rules ?? {})
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');

    const mistakesText = (methodMatch.common_mistakes ?? [])
      .map(m => `  ⚠️ ${m.mistake} → ${m.correction}`)
      .join('\n');

    systemPrompt += `\n\n---\n**Metodă BAC MD detectată** (${methodMatch.exercise_type_label}, similaritate ${(methodMatch.similarity * 100).toFixed(0)}%):\n**${methodMatch.method_name}**\n${methodMatch.description ? `\n${methodMatch.description}\n` : ''}\nEtape obligatorii:\n${stepsText}${notationText ? `\n\nNotații BAC MD:\n${notationText}` : ''}${mistakesText ? `\n\nGreșeli frecvente de evitat:\n${mistakesText}` : ''}\n\nUrmează EXACT aceste etape în ordinea specificată. Respectă notațiile BAC MD.`;
  }

  // Injectează exercițiu similar dacă există (context match)
  if (isContextMatch && ragMatch) {
    systemPrompt += `\n\n---\nContext relevant din biblioteca de exerciții (similaritate ${(ragMatch.similarity * 100).toFixed(0)}%):\nExercițiu: ${ragMatch.statement}\nSoluție: ${ragMatch.solution}`;
  }

  // ── SSE stream ─────────────────────────────────────────────────
  const encoder = new TextEncoder();
  let assistantText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ping: true })}\n\n`));

      // ── Direct library match — no AI call ───────────────────────
      if (isDirectMatch && ragMatch) {
        console.log(`[chat/route] RAG direct match (similarity=${ragMatch.similarity.toFixed(3)}) — skipping AI`);
        assistantText = ragMatch.solution;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: ragMatch.solution, source: "library" })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convId, source: "library" })}\n\n`)
        );
        controller.close();
      } else {
        // ── AI stream (with optional context) ──────────────────────
        try {
          if (isContextMatch) {
            console.log(`[chat/route] RAG context match (similarity=${ragMatch!.similarity.toFixed(3)}) — context injected`);
          }
          if (methodMatch) {
            console.log(`[chat/route] Method match: ${methodMatch.method_name} (similarity=${methodMatch.similarity.toFixed(3)})`);
          }

          const result = await callAIStream(
            taskName,
            [...priorMessages, { role: "user", content: message }],
            { system: systemPrompt }
          );

          let chunkCount = 0;
          for await (const chunk of result.textStream) {
            assistantText += chunk;
            chunkCount++;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            );
          }

          const usage = await result.usage;
          inputTokens = usage.inputTokens ?? 0;
          outputTokens = usage.outputTokens ?? 0;

          console.log(`[chat/route] stream complete. task=${taskName} chunks=${chunkCount} in=${inputTokens} out=${outputTokens}`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`
            )
          );
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Eroare AI";
          console.error("[chat/route] stream error:", err instanceof Error ? err.stack : err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
          controller.close();
        }
      }

      // ── Post-stream saves ───────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let service: any;
      try {
        service = createServiceClient();
      } catch (err) {
        console.error("[chat/route] createServiceClient failed:", err instanceof Error ? err.stack : err);
        return;
      }

      if (assistantText) {
        const { error: asstErr } = await service.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantText,
          tokens_input: inputTokens,
          tokens_output: outputTokens,
        });
        if (asstErr) {
          console.error("[chat/route] assistant message insert error:", JSON.stringify(asstErr, null, 2));
        }
      }

      // ── Log gap if no library match ─────────────────────────────
      if (!ragMatch && queryEmbedding) {
        service.from("gap_analysis").insert({
          query: message,
          query_embedding: queryEmbedding,
          user_id: user.id,
          conversation_id: convId,
          max_similarity_found: 0,
        }).then(({ error }: { error: unknown }) => {
          if (error) console.error("[chat/route] gap_analysis insert error:", error);
        });
      }

      // ── Cost log (only for AI calls) ────────────────────────────
      if (!isDirectMatch && inputTokens > 0) {
        try {
          const pricing = await getTaskPricing(taskName);
          const cost =
            (inputTokens / 1_000_000) * pricing.price_input_per_1m +
            (outputTokens / 1_000_000) * pricing.price_output_per_1m;

          const { error: logErr } = await service.from("api_usage_log").insert({
            user_id: user.id,
            model: pricing.model_name,
            task_name: taskName,
            tokens_input: inputTokens,
            tokens_output: outputTokens,
            cost_usd: cost,
            endpoint: "/api/chat",
          });
          if (logErr) {
            console.error("[chat/route] api_usage_log insert error:", JSON.stringify(logErr, null, 2));
          }
        } catch (err) {
          console.error("[chat/route] pricing/log error:", err instanceof Error ? err.stack : err);
        }
      }

      if (!isPremium) {
        try {
          const { error: rlErr } = await supabase.rpc("increment_rate_limit", {
            p_user_id: user.id,
            p_action_type: "message",
          });
          if (rlErr) {
            console.error("[chat/route] increment_rate_limit error:", JSON.stringify(rlErr, null, 2));
          }
        } catch (err) {
          console.error("[chat/route] increment_rate_limit threw:", err instanceof Error ? err.stack : err);
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Conversation-Id": convId,
    },
  });
}
