// @vitest-environment jsdom
/**
 * ETAPA 66 FAZA E1 — DOVADA memoizării: pe un mesaj lung streamat în 40 de
 * chunk-uri, blocurile complete se randează O DATĂ (contor), nu 40×.
 * Politica veche: TOT mesajul trecea prin ReactMarkdown+KaTeX la fiecare chunk.
 */
import { describe, it, expect } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MessageRenderer,
  splitMarkdownBlocks,
  __blockRenderCounter,
} from '@/app/app/chat/_components/MessageRenderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LONG_MESSAGE = Array.from(
  { length: 8 },
  (_, i) =>
    `**Pasul ${i + 1}.** Calculăm $x_{${i}}^2 + ${i}x$ și explicăm de ce rezultatul rămâne pozitiv pe intervalul dat.`
).join('\n\n');

describe('MessageRenderer — memoizare pe blocuri la streaming', () => {
  it('blocurile stabile se randează ~o dată, nu o dată per chunk', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    __blockRenderCounter.count = 0;
    const CHUNKS = 40;
    for (let i = 1; i <= CHUNKS; i++) {
      const slice = LONG_MESSAGE.slice(0, Math.ceil((LONG_MESSAGE.length * i) / CHUNKS));
      await act(async () => {
        root.render(<MessageRenderer content={slice} isStreaming />);
      });
    }
    await act(async () => {
      root.render(<MessageRenderer content={LONG_MESSAGE} isStreaming={false} />);
    });

    const totalBlocks = splitMarkdownBlocks(LONG_MESSAGE).length; // 8
    const oldPolicyRenders = totalBlocks * CHUNKS; // echivalentul re-parsării integrale per chunk
    const measured = __blockRenderCounter.count;

    console.log(
      `[E1] randări blocuri stabile: ${measured} (blocuri=${totalBlocks}, chunks=${CHUNKS}) vs politica veche ≈${oldPolicyRenders}`
    );
    expect(measured).toBeLessThanOrEqual(totalBlocks + 2);
    expect(measured).toBeLessThan(oldPolicyRenders / 10);

    await act(async () => root.unmount());
  });
});
