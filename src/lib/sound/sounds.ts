"use client";

/**
 * sounds.ts — ETAPA 70 FAZA F: cele 4 sunete discrete ale produsului.
 *
 * corect / greșit (blând) / lecție completă / streak — fișiere mici locale
 * (public/sounds, sintetizate determinist), Web Audio, preîncărcate la primul
 * gest. Toggle persistat în localStorage, default ON, volum JOS (0.25).
 * NICIUN sunet la alte click-uri — doar cele 4 momente.
 */

export type SoundName = 'correct' | 'wrong' | 'complete' | 'streak';

const STORAGE_KEY = 'mate-bac-sunete';
const VOLUME = 0.25;

let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
const buffers = new Map<SoundName, AudioBuffer>();
let preloadStarted = false;

export function soundsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) !== 'off'; // default ON
}

export function setSoundsEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = VOLUME;
    gain.connect(ctx.destination);
  }
  return ctx;
}

/** preîncarcă toate cele 4 sunete (apelată la primul gest al userului) */
export function preloadSounds(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  const c = ensureContext();
  if (!c) return;
  for (const name of ['correct', 'wrong', 'complete', 'streak'] as SoundName[]) {
    fetch(`/sounds/${name}.wav`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((ab) => (ab ? c.decodeAudioData(ab) : null))
      .then((buf) => { if (buf) buffers.set(name, buf); })
      .catch(() => { /* fără sunet > fără crash */ });
  }
}

/** redă unul dintre cele 4 sunete; tăcut dacă toggle-ul e OFF sau decode-ul a eșuat */
export function playSound(name: SoundName): void {
  if (!soundsEnabled()) return;
  const c = ensureContext();
  if (!c || !gain) return;
  if (c.state === 'suspended') void c.resume();
  preloadSounds();
  const buf = buffers.get(name);
  if (!buf) return; // încă nepreîncărcat — momentul trece, nu blocăm nimic
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(gain);
  src.start();
}
