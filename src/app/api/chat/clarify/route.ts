import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CLARIFY_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { callAIStream, getTaskPricing } from '@/lib/ai/router';
import { logApiUsage, computeLlmCost } from '@/lib/ai/usage-log';

export const dynamic = 'force-dynamic';

const FREE_MONTHLY_LIMIT = 30;

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });
  }

  // ── Tier + task per tier (ETAPA 59: nu mai rulăm pe chat_admin) ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  const status: string = profile?.subscription_status ?? 'free';
  const isPremium =
    status === 'premium' || status.startsWith('family') || status === 'admin';
  const taskName =
    status === 'admin' ? 'chat_admin'
    : status === 'premium' || status.startsWith('family') ? 'chat_premium'
    : 'chat_free';

  // ── Rate limit: un clarify = un mesaj din aceeași cotă ca chat-ul ─
  if (!isPremium) {
    let allowed: boolean | null = null;
    try {
      const { data, error: rpcErr } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action_type: 'message',
      });
      if (rpcErr) throw rpcErr;
      allowed = data as boolean;
    } catch (err) {
      console.error('[clarify] check_rate_limit threw:', err instanceof Error ? err.stack : err);
      allowed = true; // fail-open, identic cu /api/chat
    }
    if (allowed === false) {
      return NextResponse.json(
        { error: 'RATE_LIMIT_EXCEEDED', limit: FREE_MONTHLY_LIMIT },
        { status: 429 }
      );
    }
  }

  // ── Parse body ────────────────────────────────────────────────────
  let body: { selectedText?: string; question?: string; messageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }

  const { selectedText, question } = body;
  if (!selectedText?.trim() || !question?.trim()) {
    return NextResponse.json({ error: 'selectedText și question sunt obligatorii' }, { status: 400 });
  }

  // ── Build message ─────────────────────────────────────────────────
  const userMessage = `Text selectat din rezolvare:
"${selectedText.slice(0, 1000)}"

Întrebarea elevului:
${question.slice(0, 500)}

Răspunde concis, pedagogic, DOAR la întrebare.`;

  // ── Stream SSE ─────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const requestStart = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ping: true })}\n\n`));

      try {
        const result = await callAIStream(
          taskName,
          [{ role: 'user', content: userMessage }],
          { system: CLARIFY_SYSTEM_PROMPT }
        );

        let ttfbMs: number | null = null;
        for await (const chunk of result.textStream) {
          if (typeof chunk !== 'string') continue;
          if (ttfbMs === null) ttfbMs = Date.now() - requestStart;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();

        // ETAPA 66 FAZA A: logarea apelului (tokens + cache + latență din API)
        try {
          const usage = await result.usage;
          const pricing = await getTaskPricing(taskName);
          const inputTokens = usage.inputTokens ?? 0;
          const outputTokens = usage.outputTokens ?? 0;
          const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
          const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
          void logApiUsage({
            userId: user.id,
            taskName,
            model: pricing.model_name,
            endpoint: '/api/chat/clarify',
            inputTokens,
            outputTokens,
            cachedInputTokens: cacheRead,
            latencyMsTotal: Date.now() - requestStart,
            latencyMsTtfb: ttfbMs,
            costUsd: computeLlmCost({
              inputTokens, outputTokens,
              cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite,
              priceInputPer1M: pricing.price_input_per_1m,
              priceOutputPer1M: pricing.price_output_per_1m,
            }),
          });
        } catch (logErr) {
          console.error('[clarify] usage log failed:', logErr instanceof Error ? logErr.message : logErr);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Eroare AI';
        console.error('[clarify] stream error:', err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }

      // ── Consumă din cotă, ca în /api/chat ──────────────────────────
      if (!isPremium) {
        try {
          const { error: rlErr } = await supabase.rpc('increment_rate_limit', {
            p_user_id: user.id,
            p_action_type: 'message',
          });
          if (rlErr) console.error('[clarify] increment_rate_limit error:', JSON.stringify(rlErr));
        } catch (err) {
          console.error('[clarify] increment_rate_limit threw:', err instanceof Error ? err.stack : err);
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
