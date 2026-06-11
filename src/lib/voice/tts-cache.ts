/**
 * tts-cache.ts — ETAPA 75 FAZA F: pipeline-ul + cheia cache-ului TTS,
 * EXTRASE ca sursă unică pentru ruta /api/voice/synthesize ȘI pre-generatorul
 * de la build (aceleași chei = hit garantat la servire).
 */
import { createHash } from 'node:crypto';
import { latexToSpeech } from '@/lib/voice/latex-to-speech';

export const TTS_BUCKET = 'tts-cache';
export const TTS_SPEED = 0.95;
export const TTS_MAX_CHARS = 4096;
export const TTS_PRICE_PER_CHAR = 15 / 1_000_000; // OpenAI tts-1: $15 / 1M caractere

/**
 * Elimină explicații redundante în formatul "ACRONIM (Explicație lungă)".
 * Ex: "DVA (Domeniu Valorilor Admisibile)" → "DVA"
 */
export function deduplicateExplanations(text: string): string {
  return text.replace(/\b([A-ZĂÂÎȘȚ]{2,}[A-ZĂÂÎȘȚ0-9]*)\s*\(([^)]{12,})\)/g, '$1');
}

/** textul EXACT trimis la TTS (pipeline-ul rutei) */
export function toSpeechText(rawText: string): string {
  return latexToSpeech(deduplicateExplanations(rawText)).slice(0, TTS_MAX_CHARS);
}

/** cheia de cache — acoperă tot ce influențează audio-ul */
export function ttsCacheKey(speechText: string, voice: string): string {
  return createHash('sha256').update(`${speechText}|${voice}|${TTS_SPEED}`).digest('hex') + '.mp3';
}
