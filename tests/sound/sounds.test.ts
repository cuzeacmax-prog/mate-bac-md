// @vitest-environment jsdom
/**
 * ETAPA 70 FAZA F — sunetele discrete: toggle persistat (default ON),
 * play() respectă toggle-ul, fișierele WAV există și sunt valide RIFF.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { soundsEnabled, setSoundsEnabled, playSound, preloadSounds } from '@/lib/sound/sounds';

// AudioContext mock — jsdom nu are Web Audio
class FakeGain {
  gain = { value: 0 };
  connect = vi.fn();
}
class FakeSource {
  buffer: unknown = null;
  connect = vi.fn();
  start = vi.fn();
}
const startCalls: FakeSource[] = [];
class FakeAudioContext {
  state = 'running';
  destination = {};
  createGain() { return new FakeGain(); }
  createBufferSource() { const s = new FakeSource(); startCalls.push(s); return s; }
  decodeAudioData(_ab: ArrayBuffer) { return Promise.resolve({ duration: 0.3 } as AudioBuffer); }
  resume() { return Promise.resolve(); }
}

beforeEach(() => {
  window.localStorage.clear();
  startCalls.length = 0;
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } as Response)
  ) as unknown as typeof fetch;
});

describe('toggle-ul de sunete', () => {
  it('default ON (fără cheie în localStorage)', () => {
    expect(soundsEnabled()).toBe(true);
  });
  it('OFF se persistă în localStorage și se respectă', () => {
    setSoundsEnabled(false);
    expect(window.localStorage.getItem('mate-bac-sunete')).toBe('off');
    expect(soundsEnabled()).toBe(false);
    playSound('correct');
    expect(startCalls.length).toBe(0); // niciun sunet pornit
  });
  it('ON la loc → persistat', () => {
    setSoundsEnabled(false);
    setSoundsEnabled(true);
    expect(window.localStorage.getItem('mate-bac-sunete')).toBe('on');
    expect(soundsEnabled()).toBe(true);
  });
});

describe('redarea după preîncărcare', () => {
  it('play() pornește o sursă DOAR după decode și doar cu toggle ON', async () => {
    preloadSounds();
    await new Promise((r) => setTimeout(r, 10)); // lasă fetch+decode să se așeze
    playSound('correct');
    expect(startCalls.length).toBe(1);
    expect(startCalls[0].start).toHaveBeenCalledTimes(1);
  });
});

describe('fișierele WAV (public/sounds)', () => {
  for (const name of ['correct', 'wrong', 'complete', 'streak']) {
    it(`${name}.wav există, e RIFF/WAVE valid și sub 1 secundă`, () => {
      const buf = readFileSync(join(process.cwd(), 'public', 'sounds', `${name}.wav`));
      expect(buf.subarray(0, 4).toString()).toBe('RIFF');
      expect(buf.subarray(8, 12).toString()).toBe('WAVE');
      const sampleRate = buf.readUInt32LE(24);
      const dataSize = buf.readUInt32LE(40);
      const seconds = dataSize / 2 / sampleRate;
      expect(seconds).toBeGreaterThan(0.1);
      expect(seconds).toBeLessThan(1); // scurte, discrete
      expect(buf.length).toBeLessThan(50_000); // mici
    });
  }
});
