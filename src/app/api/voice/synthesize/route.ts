import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { latexToSpeech } from '@/lib/voice/latex-to-speech';

export const dynamic = 'force-dynamic';

const ALLOWED_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautentificat' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────
  let body: { text?: string; voice?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 });
  }

  const rawText = body.text ?? '';
  const voice = ALLOWED_VOICES.has(body.voice ?? '') ? (body.voice ?? 'nova') : 'nova';

  if (!rawText.trim()) {
    return NextResponse.json({ error: 'text este obligatoriu' }, { status: 400 });
  }

  // ── LaTeX → Speech text ───────────────────────────────────────────
  const speechText = latexToSpeech(rawText).slice(0, 4096); // TTS-1 max 4096 chars

  // ── OpenAI TTS-1 ─────────────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: 'Voice mode necesită OPENAI_API_KEY. Adaugă în .env.local și Vercel.' },
      { status: 501 }
    );
  }

  try {
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice,
        input: speechText,
        response_format: 'mp3',
        speed: 0.95,
      }),
    });

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error('[voice/synthesize] OpenAI error:', errText);
      return NextResponse.json({ error: 'TTS failed' }, { status: 502 });
    }

    // Stream audio direct la client cu caching (1h)
    const audioBlob = await ttsResponse.arrayBuffer();
    return new NextResponse(audioBlob, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Length': String(audioBlob.byteLength),
      },
    });
  } catch (err) {
    console.error('[voice/synthesize] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Eroare internă TTS' }, { status: 500 });
  }
}
