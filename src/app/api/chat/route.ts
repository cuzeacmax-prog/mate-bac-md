import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SYSTEM_PROMPT_V1 } from "@/lib/ai/system-prompt";

const FREE_MONTHLY_LIMIT = 30;
const IS_DEV = process.env.NODE_ENV === "development";

function serverError(label: string, err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[chat/route] ${label}:`, err instanceof Error ? err.stack : err);
  return NextResponse.json(
    { error: IS_DEV ? `${label}: ${msg}` : "Eroare internă. Încearcă din nou." },
    { status: 500 }
  );
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
    console.log("[chat/route] unauthenticated");
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }
  console.log("[chat/route] user:", user.id);

  // ── Parse body ──────────────────────────────────────────────────
  let body: { message: string; conversationId?: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error("[chat/route] body parse failed:", err);
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  const { message, conversationId } = body;
  console.log("[chat/route] message length:", message?.length, "convId:", conversationId ?? "new");

  if (!message?.trim()) {
    return NextResponse.json({ error: "Mesaj gol" }, { status: 400 });
  }

  // ── Anthropic init ──────────────────────────────────────────────
  console.log("[chat] using anthropic key prefix:", process.env.ANTHROPIC_API_KEY?.substring(0, 13));
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[chat/route] ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Profile + premium check ─────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (profileErr) {
    return serverError("profile fetch", profileErr);
  }
  console.log("[chat/route] profile subscription_status:", profile?.subscription_status);

  const isPremium =
    (profile?.subscription_status ?? "") === "premium" ||
    (profile?.subscription_status ?? "").startsWith("family");

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
      console.log("[chat/route] check_rate_limit result:", allowed);
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
    console.log("[chat/route] new conversation created:", convId);
  } else {
    console.log("[chat/route] using existing conversation:", convId);
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
  console.log("[chat/route] history loaded:", (history ?? []).length, "messages");

  const priorMessages: Anthropic.MessageParam[] = (
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
  console.log("[chat/route] user message saved");

  // ── SSE stream ─────────────────────────────────────────────────
  const encoder = new TextEncoder();
  let assistantText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const MODEL = "claude-sonnet-4-5";

  console.log("[chat/route] returning SSE response, model:", MODEL);

  const stream = new ReadableStream({
    async start(controller) {
      console.log("[chat/route] stream start() called");

      // Ping inițial — confirmă că streaming-ul funcționează
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ping: true })}\n\n`));
      console.log("[chat/route] ping enqueued");

      // ── Anthropic streaming ─────────────────────────────────────
      try {
        console.log("[DEBUG] priorMessages:", JSON.stringify(priorMessages, null, 2));
        console.log("[DEBUG] new message:", message);
        console.log("[chat/route] calling anthropic.messages.stream...");
        const claudeStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 2048,
          system: SYSTEM_PROMPT_V1,
          messages: [...priorMessages, { role: "user", content: message }],
        });

        let chunkCount = 0;
        for await (const event of claudeStream) {
          console.log("[DEBUG] event type:", event.type);
          if (event.type === "message_start") console.log("[DEBUG] full message_start:", JSON.stringify(event, null, 2));
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            assistantText += chunk;
            chunkCount++;
            if (chunkCount === 1) {
              console.log("[chat/route] first chunk received:", JSON.stringify(chunk.slice(0, 50)));
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            );
          }
          if (event.type === "message_start" && event.message.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
          if (event.type === "message_delta" && event.usage) {
            outputTokens = event.usage.output_tokens;
          }
        }

        console.log(`[chat/route] stream complete. chunks=${chunkCount} in=${inputTokens} out=${outputTokens}`);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Eroare AI";
        const stack = err instanceof Error ? err.stack : String(err);
        console.error("[chat/route] anthropic stream error:", stack);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
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
        } else {
          console.log("[chat/route] assistant message saved, length:", assistantText.length);
        }
      }

      const { error: logErr } = await service.from("api_usage_log").insert({
        user_id: user.id,
        model: MODEL,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        endpoint: "/api/chat",
      });
      if (logErr) {
        console.error("[chat/route] api_usage_log insert error:", JSON.stringify(logErr, null, 2));
      }

      if (!isPremium) {
        try {
          const { error: rlErr } = await supabase.rpc("increment_rate_limit", {
            p_user_id: user.id,
            p_action_type: "message",
          });
          if (rlErr) {
            console.error("[chat/route] increment_rate_limit error:", JSON.stringify(rlErr, null, 2));
          } else {
            console.log("[chat/route] rate limit incremented");
          }
        } catch (err) {
          console.error("[chat/route] increment_rate_limit threw:", err instanceof Error ? err.stack : err);
        }
      }

      console.log("[chat/route] start() finished");
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
