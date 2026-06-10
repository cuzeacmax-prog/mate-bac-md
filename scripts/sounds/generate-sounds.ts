/**
 * generate-sounds.ts — ETAPA 70 FAZA F: sintetizează cele 4 sunete discrete
 * ale produsului (WAV mono 22.05kHz, 16-bit) în public/sounds/.
 * Determinist: tonuri sinus cu anvelopă — fără asset-uri externe, fără licențe.
 *
 *   npx tsx scripts/sounds/generate-sounds.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SR = 22050;

interface Note { freq: number; start: number; dur: number; gain?: number }

function synth(notes: Note[], totalSec: number): Int16Array {
  const n = Math.ceil(totalSec * SR);
  const buf = new Float64Array(n);
  for (const note of notes) {
    const g = note.gain ?? 0.55;
    const s0 = Math.floor(note.start * SR);
    const len = Math.floor(note.dur * SR);
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / SR;
      // anvelopă: atac 8ms, decay exponențial — sunet moale, nu beep agresiv
      const attack = Math.min(1, t / 0.008);
      const decay = Math.exp(-3.2 * (t / note.dur));
      // fundamentală + puțină armonică a doua pentru căldură
      const sample =
        Math.sin(2 * Math.PI * note.freq * t) * 0.85 +
        Math.sin(2 * Math.PI * note.freq * 2 * t) * 0.15;
      buf[s0 + i] += sample * attack * decay * g;
    }
  }
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, buf[i])) * 32767;
  return out;
}

function wav(samples: Int16Array): Buffer {
  const dataSize = samples.length * 2;
  const b = Buffer.alloc(44 + dataSize);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataSize, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(samples[i], 44 + i * 2);
  return b;
}

// notele (Hz): C5=523.25 E5=659.25 G5=783.99 C6=1046.5 E4=329.63 C4=261.63 A5=880
const SOUNDS: Record<string, { notes: Note[]; total: number }> = {
  // corect: două note ascendente scurte — confirmare caldă
  correct: { notes: [
    { freq: 523.25, start: 0, dur: 0.12 },
    { freq: 659.25, start: 0.09, dur: 0.18 },
  ], total: 0.3 },
  // greșit: două note coborâtoare BLÂNDE, volum mai mic — nu punitiv
  wrong: { notes: [
    { freq: 329.63, start: 0, dur: 0.14, gain: 0.4 },
    { freq: 261.63, start: 0.11, dur: 0.2, gain: 0.35 },
  ], total: 0.35 },
  // lecție completă: arpegiu C-E-G-C — mică celebrare
  complete: { notes: [
    { freq: 523.25, start: 0, dur: 0.14 },
    { freq: 659.25, start: 0.1, dur: 0.14 },
    { freq: 783.99, start: 0.2, dur: 0.14 },
    { freq: 1046.5, start: 0.3, dur: 0.28 },
  ], total: 0.62 },
  // streak: scânteie — două note înalte rapide
  streak: { notes: [
    { freq: 783.99, start: 0, dur: 0.1 },
    { freq: 1046.5, start: 0.07, dur: 0.12 },
    { freq: 880, start: 0.16, dur: 0.16, gain: 0.45 },
  ], total: 0.36 },
};

const dir = join(process.cwd(), 'public', 'sounds');
mkdirSync(dir, { recursive: true });
for (const [name, def] of Object.entries(SOUNDS)) {
  const file = join(dir, `${name}.wav`);
  writeFileSync(file, wav(synth(def.notes, def.total)));
  console.log(`${name}.wav: ${def.total}s`);
}
console.log('gata — 4 sunete în public/sounds/');
