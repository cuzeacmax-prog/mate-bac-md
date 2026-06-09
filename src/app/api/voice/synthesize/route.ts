import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { latexToSpeech } from '@/lib/voice/latex-to-speech';
import { logApiUsage } from '@/lib/ai/usage-log';

// OpenAI tts-1: $15.00 / 1M caractere (tokens_input = caractere pentru task 'tts')
const TTS_PRICE_PER_CHAR = 15 / 1_000_000;

// ETAPA 66 FAZA C: cache persistent în Storage. Enunțurile din bibliotecă sunt
// FINITE → hit rate crește natural. Cheia acoperă tot ce influențează audio-ul.
const TTS_BUCKET = 'tts-cache';
const TTS_SPEED = 0.95;

function ttsCacheKey(speechText: string, voice: string): string {
  return createHash('sha256').update(`${speechText}|${voice}|${TTS_SPEED}`).digest('hex') + '.mp3';
}

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
  const supabase = await createClient();
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

  // ── Cache Storage: hit → servește fără OpenAI ─────────────────────
  const service = createServiceClient();
  const cacheKey = ttsCacheKey(speechText, voice);
  try {
    const hitStart = Date.now();
    const { data: cached } = await service.storage.from(TTS_BUCKET).download(cacheKey);
    if (cached) {
      const bytes = await cached.arrayBuffer();
      void logApiUsage({
        userId: user.id,
        taskName: 'tts',
        model: 'tts-cache',
        endpoint: '/api/voice/synthesize',
        inputTokens: speechText.length,
        outputTokens: 0,
        latencyMsTotal: Date.now() - hitStart,
        costUsd: 0,
      });
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(bytes.byteLength),
          'X-TTS-Cache': 'hit',
        },
      });
    }
  } catch (err) {
    // cache-ul nu are voie să strice TTS-ul — miss forțat
    console.error('[voice/synthesize] cache read failed:', err instanceof Error ? err.message : err);
  }

  // ── OpenAI TTS-1 (miss) ───────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: 'Voice mode necesită OPENAI_API_KEY. Adaugă în .env.local și Vercel.' },
      { status: 501 }
    );
  }

  try {
    const ttsStart = Date.now();
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

    // ETAPA 59 (P8): fără Cache-Control — răspunsurile POST nu se cache-uiesc
    // în browser; header-ul era inutil și inducea în eroare.
    const audioBlob = await ttsResponse.arrayBuffer();

    // ETAPA 66 FAZA A: log TTS (tokens_input = caractere trimise la tts-1)
    void logApiUsage({
      userId: user.id,
      taskName: 'tts',
      model: 'tts-1',
      endpoint: '/api/voice/synthesize',
      inputTokens: speechText.length,
      outputTokens: 0,
      latencyMsTotal: Date.now() - ttsStart,
      costUsd: speechText.length * TTS_PRICE_PER_CHAR,
    });

    // ETAPA 66 FAZA C: scrie în cache (best-effort, nu blochează răspunsul)
    void service.storage
      .from(TTS_BUCKET)
      .upload(cacheKey, Buffer.from(audioBlob), { contentType: 'audio/mpeg', upsert: true })
      .then(({ error }) => {
        if (error) console.error('[voice/synthesize] cache write failed:', error.message);
      });

    return new NextResponse(audioBlob, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBlob.byteLength),
        'X-TTS-Cache': 'miss',
      },
    });
  } catch (err) {
    console.error('[voice/synthesize] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Eroare internă TTS' }, { status: 500 });
  }
}
