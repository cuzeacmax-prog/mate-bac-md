import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SYSTEM_PROMPT_V1 } from "@/lib/ai/system-prompt";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FREE_MONTHLY_LIMIT = 30;

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  let body: { message: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  const { message, conversationId } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mesaj gol" }, { status: 400 });
  }

  // ── Rate limit check ────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, messages_used_this_month, messages_reset_at")
    .eq("id", user.id)
    .single();

  const isPremium =
    (profile?.subscription_status ?? "") === "premium" ||
    (profile?.subscription_status ?? "").startsWith("family");

  if (!isPremium) {
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      p_user_id: user.id,
      p_action_type: "chat_message",
    });
    if (!allowed) {
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
      return NextResponse.json({ error: "Nu pot crea conversația" }, { status: 500 });
    }
    convId = conv.id as string;
  }

  // ── Load history (last 20 messages) ────────────────────────────
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);

  const priorMessages: Anthropic.MessageParam[] = ((history as { role: string; content: string | null }[]) ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));

  // ── Save user message ───────────────────────────────────────────
  await supabase.from("messages").insert({
    conversation_id: convId,
    role: "user",
    content: message,
  });

  // ── Stream from Claude ──────────────────────────────────────────
  const encoder = new TextEncoder();
  let assistantText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM_PROMPT_V1,
          messages: [
            ...priorMessages,
            { role: "user", content: message },
          ],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            assistantText += chunk;
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

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Eroare AI";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
      } finally {
        // ── Post-stream: save assistant message + increment rate limit ─
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const service = createServiceClient() as any;
        await service.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantText,
          tokens_input: inputTokens,
          tokens_output: outputTokens,
        });

        await service.from("api_usage_log").insert({
          user_id: user.id,
          model: "claude-sonnet-4-6",
          tokens_input: inputTokens,
          tokens_output: outputTokens,
          action_type: "chat_message",
        });

        if (!isPremium) {
          await supabase.rpc("increment_rate_limit", {
            p_user_id: user.id,
            p_action_type: "chat_message",
          });
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
