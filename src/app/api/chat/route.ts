import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STUDY_SYSTEM_PROMPT, SOLVE_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { callAIStream, callAIStreamWithTools, getTaskPricing } from "@/lib/ai/router";
import { generateEmbeddingForQuery } from "@/lib/embeddings/gemini";
import {
  findRelevantMethods,
  buildMultiMethodInstruction,
  buildMethodInstruction,
  type SolutionMethod,
} from "@/lib/rag/solution-methods";
import { decomposeQuery, type DecomposedQuery } from "@/lib/chat/query-decomposer";
import { resolveToolsForMethod, hasTools } from "@/lib/tools/tool-resolver";
import { verifyMath, type VerificationResult } from "@/lib/chat/math-verifier";

const FREE_MONTHLY_LIMIT = 30;
const IS_DEV = process.env.NODE_ENV === "development";

const RAG_DIRECT_THRESHOLD = 0.85;
const RAG_CONTEXT_THRESHOLD = 0.65;
const METHOD_THRESHOLD = 0.45; // relaxat: 0.55 → 0.45 pentru match-uri mai dese

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

// findRelevantMethods este importat din @/lib/rag/solution-methods

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
  let body: { message: string; conversationId?: string; mode?: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error("[chat/route] body parse failed:", err);
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  const { message, conversationId, mode } = body;
  const chatMode: 'study' | 'solve' = mode === 'solve' ? 'solve' : 'study';
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mesaj gol" }, { status: 400 });
  }

  // ── ETAPA 59 (P6): pașii independenți rulează CONCURENT ─────────
  // profil ∥ embedding+match bibliotecă ∥ istoric conversație existentă
  const [profileResult, libraryResult, historyResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single(),
    lookupLibrary(message),
    conversationId
      ? supabase
          .from("messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(20)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const { data: profile, error: profileErr } = profileResult;
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

  const { match: ragMatch, embedding: queryEmbedding } = libraryResult;
  const isDirectMatch = ragMatch !== null && ragMatch.similarity >= RAG_DIRECT_THRESHOLD;
  const isContextMatch = ragMatch !== null && ragMatch.similarity >= RAG_CONTEXT_THRESHOLD && !isDirectMatch;

  // ── Rate limit ∥ metode BAC MD (independente între ele) ─────────
  const [allowed, relevantMethods] = await Promise.all([
    (async (): Promise<boolean> => {
      if (isPremium) return true;
      try {
        const { data, error: rpcErr } = await supabase.rpc("check_rate_limit", {
          p_user_id: user.id,
          p_action_type: "message",
        });
        if (rpcErr) throw rpcErr;
        return data !== false;
      } catch (err) {
        console.error("[chat/route] check_rate_limit threw:", err instanceof Error ? err.stack : err);
        return true; // fail-open
      }
    })(),
    (async (): Promise<SolutionMethod[]> =>
      queryEmbedding
        ? findRelevantMethods(queryEmbedding, { threshold: METHOD_THRESHOLD, limit: 2 })
        : [])(),
  ]);

  if (!allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT_EXCEEDED", limit: FREE_MONTHLY_LIMIT },
      { status: 429 }
    );
  }

  // ── Conversation create or load (abia DUPĂ rate-limit, ca un 429 să nu lase rânduri) ──
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

  const { data: history, error: historyErr } = historyResult;
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

  // ── System prompt — mode-specific + inject metode BAC MD + context RAG ──
  let systemPrompt = chatMode === 'solve' ? SOLVE_SYSTEM_PROMPT : STUDY_SYSTEM_PROMPT;

  // Injectează instrucțiunile metodei detectate (via helper din solution-methods.ts)
  const methodInstruction = buildMultiMethodInstruction(relevantMethods);
  if (methodInstruction) {
    systemPrompt += `\n\n${methodInstruction}`;
  }

  // Injectează exercițiu similar dacă există (context match)
  if (isContextMatch && ragMatch) {
    systemPrompt += `\n\n---\nContext relevant din biblioteca de exerciții (similaritate ${(ragMatch.similarity * 100).toFixed(0)}%):\nExercițiu: ${ragMatch.statement}\nSoluție: ${ragMatch.solution}`;
  }

  // ── Multi-exercise decompose (regex fast-path → Haiku) ────────
  let decomposed: DecomposedQuery | null = null;
  try {
    decomposed = await decomposeQuery(message);
  } catch {
    decomposed = { isMulti: false, exercises: [{ id: 1, text: message, detectedType: 'other' }], rawQuery: message };
  }
  const isMultiExercise = decomposed.isMulti && decomposed.exercises.length > 1;

  // ── Tool Use: determină dacă există tooluri disponibile ────────
  const topMethod = relevantMethods[0] ?? null;
  const toolsAvailable = hasTools(topMethod?.required_tools, topMethod?.exercise_type);
  const toolsToUse = topMethod
    ? resolveToolsForMethod(topMethod.required_tools, topMethod.exercise_type)
    : {};

  // ── Telemetrie structurată ─────────────────────────────────────
  console.log('[chat] Request telemetry:', {
    userQueryLength: message.length,
    methodsFound: relevantMethods.length,
    topMethod: relevantMethods[0]?.exercise_type ?? 'none',
    topSimilarity: relevantMethods[0]?.similarity?.toFixed(3) ?? 'n/a',
    exercisesFound: ragMatch ? 1 : 0,
    ragDirectMatch: isDirectMatch,
    ragContextMatch: isContextMatch,
    isMultiExercise,
    toolsAvailable,
    toolCount: Object.keys(toolsToUse).length,
  });

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
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              conversationId: convId,
              source: "library",
              metadata: {
                method_used: relevantMethods[0]?.exercise_type ?? null,
                method_similarity: relevantMethods[0]?.similarity ?? null,
                exercises_matched: 1,
              },
            })}\n\n`
          )
        );
        controller.close();
      } else {
        // ── AI stream (tool use + multi-exercise paths) ──────────────
        try {
          if (isContextMatch) {
            console.log(`[chat/route] RAG context match (similarity=${ragMatch!.similarity.toFixed(3)}) — context injected`);
          }
          if (relevantMethods.length > 0) {
            console.log(`[chat/route] Methods matched (${relevantMethods.length}):`);
            for (const m of relevantMethods) {
              console.log(`  - ${m.exercise_type} "${m.method_name}" (similarity=${m.similarity.toFixed(3)})`);
            }
          }
          if (toolsAvailable) {
            console.log(`[chat/route] Tool use enabled: ${Object.keys(toolsToUse).join(', ')}`);
          }

          // ── Multi-exercise: rezolvare per-exercițiu ──────────────
          if (isMultiExercise && decomposed) {
            const parts: string[] = [];
            const allSvgs: string[] = [];

            for (const ex of decomposed.exercises) {
              // RAG pentru sub-exercițiu (refolosim embedding global dacă textul e similar)
              let exSystemPrompt = chatMode === 'solve' ? SOLVE_SYSTEM_PROMPT : STUDY_SYSTEM_PROMPT;
              let exTools = {};

              // Metodă specifică sub-exercițiului (Gemini call per exercițiu)
              if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                try {
                  const exEmbedding = await generateEmbeddingForQuery(ex.text);
                  const exMethods = await findRelevantMethods(exEmbedding, { threshold: METHOD_THRESHOLD, limit: 1 });
                  if (exMethods.length > 0) {
                    exSystemPrompt += `\n\n${buildMethodInstruction(exMethods[0])}`;
                    exTools = resolveToolsForMethod(exMethods[0].required_tools, exMethods[0].exercise_type);
                  }
                } catch { /* continue without method */ }
              }

              const exResult = await callAIStreamWithTools(
                taskName,
                [...priorMessages, { role: "user", content: ex.text }],
                { system: exSystemPrompt, tools: Object.keys(exTools).length > 0 ? exTools : undefined, maxToolSteps: 3 }
              );

              let exText = '';
              for await (const event of exResult.fullStream) {
                if (event.type === 'text-delta') {
                  // Guard: ensure we have a real string — SDK may surprise at runtime
                  const chunk = event.text;
                  if (typeof chunk !== 'string') continue;
                  exText += chunk;
                  assistantText += chunk;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                }
                if (event.type === 'tool-result') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const out = (event as any).output as Record<string, unknown> | undefined;
                  if (typeof out?.svg === 'string' && out.svg) allSvgs.push(out.svg);
                }
              }

              parts.push(exText);

              // Separator between exercises (stream to client)
              if (ex.id < decomposed.exercises.length) {
                const sep = '\n\n---\n\n';
                assistantText += sep;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: sep })}\n\n`));
              }

              const exUsage = await exResult.usage;
              inputTokens += exUsage.inputTokens ?? 0;
              outputTokens += exUsage.outputTokens ?? 0;
            }

            console.log(`[chat/route] multi-exercise complete. exercises=${decomposed.exercises.length} svgs=${allSvgs.length}`);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  conversationId: convId,
                  metadata: {
                    isMulti: true,
                    exerciseCount: decomposed.exercises.length,
                    method_used: relevantMethods[0]?.exercise_type ?? null,
                    method_similarity: relevantMethods[0]?.similarity ?? null,
                    exercises_matched: isContextMatch ? 1 : 0,
                    svgs: allSvgs,
                  },
                })}\n\n`
              )
            );

          // ── Single exercise (with or without tools) ───────────────
          } else {
            const svgOutputs: string[] = [];

            const result = toolsAvailable
              ? await callAIStreamWithTools(taskName, [...priorMessages, { role: "user", content: message }], { system: systemPrompt, tools: toolsToUse, maxToolSteps: 3 })
              : await callAIStream(taskName, [...priorMessages, { role: "user", content: message }], { system: systemPrompt });

            let chunkCount = 0;

            if (toolsAvailable) {
              // Use fullStream to capture both text and tool results
              for await (const event of result.fullStream) {
                if (event.type === 'text-delta') {
                  // Guard: ensure we have a real string — SDK may surprise at runtime
                  const chunk = event.text;
                  if (typeof chunk !== 'string') continue;
                  assistantText += chunk;
                  chunkCount++;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                }
                if (event.type === 'tool-result') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const out = (event as any).output as Record<string, unknown> | undefined;
                  if (typeof out?.svg === 'string' && out.svg) {
                    svgOutputs.push(out.svg);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    console.log(`[chat/route] SVG collected from tool: ${(event as any).toolName}`);
                  }
                }
              }
            } else {
              // No tools: use textStream (simpler)
              for await (const chunk of result.textStream) {
                assistantText += chunk;
                chunkCount++;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
              }
            }

            const usage = await result.usage;
            inputTokens = usage.inputTokens ?? 0;
            outputTokens = usage.outputTokens ?? 0;

            console.log(`[chat/route] stream complete. task=${taskName} chunks=${chunkCount} svgs=${svgOutputs.length} in=${inputTokens} out=${outputTokens}`);

            // ── ETAPA 59 (P5): done pleacă IMEDIAT după ultimul token ──
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  conversationId: convId,
                  metadata: {
                    isMulti: false,
                    exerciseCount: 1,
                    method_used: relevantMethods[0]?.exercise_type ?? null,
                    method_similarity: relevantMethods[0]?.similarity ?? null,
                    exercises_matched: isContextMatch ? 1 : 0,
                    svgs: svgOutputs,
                  },
                })}\n\n`
              )
            );

            // ── Verificare matematică DUPĂ done (eveniment separat) ──
            // Sărită când răspunsul conține SVG-uri din calculatoare
            // (matematica e deja calculată determinist de tool-uri).
            if (assistantText && chatMode === 'study' && svgOutputs.length === 0) {
              try {
                const vResult = await Promise.race([
                  verifyMath(message, assistantText),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
                ]);
                if (vResult && vResult.confidence > 0) {
                  const verificationData: Pick<VerificationResult, 'isCorrect' | 'confidence'> =
                    { isCorrect: vResult.isCorrect, confidence: vResult.confidence };
                  console.log(`[chat/route] verification done (post-done): isCorrect=${vResult.isCorrect} confidence=${vResult.confidence.toFixed(2)}`);
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ verification: verificationData })}\n\n`)
                  );
                }
              } catch (vErr) {
                console.warn('[chat/route] verification skipped:', vErr instanceof Error ? vErr.message : vErr);
              }
            }
          }

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
