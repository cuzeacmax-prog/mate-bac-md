// @vitest-environment jsdom
/**
 * ETAPA 72 P2 — NICIUN mesaj nu dispare: boundary-ul PER MESAJ.
 * Un mesaj a cărui randare ARUNCĂ apare ca fallback (text brut + „afișare
 * simplificată"), iar restul conversației rămâne vizibil.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

// mesajul-bombă: MessageBubble aruncă DOAR pentru marcajul special
const BOMB_MARKER = '__BOMBA_RANDARII__';
vi.mock('@/app/app/chat/_components/MessageBubble', () => ({
  MessageBubble: ({ content }: { content: string }) => {
    if (content.includes(BOMB_MARKER)) throw new Error('randare crăpată deliberat');
    return <div data-testid="bubble">{content}</div>;
  },
}));

import { ChatMessages } from '@/app/app/chat/_components/ChatMessages';

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true } as Response)) as unknown as typeof fetch;
  Element.prototype.scrollIntoView = vi.fn();
});

describe('MessageErrorBoundary per mesaj', () => {
  it('mesajul care crapă → fallback; conversația ÎNTREAGĂ rămâne vizibilă', () => {
    const bombContent = `Formula $x_G = \\frac{ ${BOMB_MARKER} LaTeX nebalansat {bloc invalid`;
    const messages = [
      { id: 'm1', role: 'user' as const, content: 'Întrebarea elevului' },
      { id: 'm2', role: 'assistant' as const, content: bombContent },
      { id: 'm3', role: 'assistant' as const, content: 'Mesajul de după bombă' },
    ];
    const host = document.createElement('div');
    document.body.appendChild(host);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      createRoot(host).render(<ChatMessages messages={messages} />);
    });
    consoleSpy.mockRestore();

    const html = host.innerHTML;
    // 1) mesajele sănătoase sunt INTACTE
    expect(html).toContain('Întrebarea elevului');
    expect(html).toContain('Mesajul de după bombă');
    // 2) mesajul crăpat apare ca FALLBACK cu textul brut + marcajul discret
    expect(html).toContain('afișare simplificată');
    expect(html).toContain(BOMB_MARKER);
    // 3) eroarea s-a logat client → server
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/log/render-error',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
