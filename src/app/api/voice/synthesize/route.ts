import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { latexToSpeech } from '@/lib/voice/latex-to-speech';

/**
 * Elimină explicații redundante în formatul "ACRONIM (Explicație lungă)".
 * Aplicat ÎNAINTE de latexToSpeech pentru a nu mai ajunge în TTS.
 * Ex: "DVA (Domeniu Valorilor Admisibile)" → "DVA"
 */
function deduplicateExplanations(text: string): string {
  // Acronim ≥2 litere majuscule + paranteză cu conținut lung (≥12 caractere)
  return text.replace(
    /\b([A-ZĂÂÎȘȚ]{2,}[A-ZĂÂÎȘȚ0-9]*)\s*\(([^)]{12,})\)/g,
    '$1'
  );
}

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

  // ── Pre-procesare + LaTeX → Speech text ──────────────────────────
  const deduped = deduplicateExplanations(rawText);
  const speechText = latexToSpeech(deduped).slice(0, 4096); // TTS-1 max 4096 chars

  // Dev logging pentru debugging calitate TTS
  if (process.env.NODE_ENV === 'development') {
    console.log('[voice/synthesize] Original length:', rawText.length);
    console.log('[voice/synthesize] After dedup:', deduped.length);
    console.log('[voice/synthesize] Speech text:', speechText.slice(0, 200), speechText.length > 200 ? '…' : '');
  }

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
