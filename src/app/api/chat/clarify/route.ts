import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CLARIFY_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { callAIStream } from '@/lib/ai/router';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });
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

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ping: true })}\n\n`));

      try {
        // Clarify uses the same AI router as main chat (admin tier for simplicity)
        const result = await callAIStream(
          'chat_admin',
          [{ role: 'user', content: userMessage }],
          { system: CLARIFY_SYSTEM_PROMPT }
        );

        for await (const chunk of result.textStream) {
          if (typeof chunk !== 'string') continue;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Eroare AI';
        console.error('[clarify] stream error:', err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
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
