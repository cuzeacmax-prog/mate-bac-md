'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, X, Send, Loader2 } from 'lucide-react';
import { type Interaction, useInteractionsStore } from '@/lib/stores/interactions-store';
import { MessageRenderer } from '@/app/app/chat/_components/MessageRenderer';

interface Props {
  interaction: Interaction;
  messageId: string;
}

export function InlineMiniChat({ interaction, messageId }: Props) {
  const { updateInteraction, removeInteraction, toggleMinimize } = useInteractionsStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const hasResponse = interaction.response.length > 0;

  async function handleSubmit() {
    const q = inputValue.trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    updateInteraction(interaction.id, { question: q, response: '', isStreaming: true });

    try {
      const res = await fetch('/api/chat/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: interaction.selectedText,
          question: q,
          messageId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          let json: Record<string, unknown>;
          try { json = JSON.parse(line.slice(6)); } catch { continue; }
          if (json.ping) continue;
          if (json.error) throw new Error(json.error as string);
          if (json.text) {
            fullResponse += json.text as string;
            updateInteraction(interaction.id, { response: fullResponse });
          }
          if (json.done) break;
        }
      }

      updateInteraction(interaction.id, { isStreaming: false });
    } catch (err) {
      updateInteraction(interaction.id, {
        response: `Eroare: ${err instanceof Error ? err.message : 'Necunoscută'}`,
        isStreaming: false,
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Minimized pill ────────────────────────────────────────────────
  if (interaction.isMinimized) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => toggleMinimize(interaction.id)}
        className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-400 text-xs text-blue-700 dark:text-blue-300 rounded-r hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-left max-w-full"
        aria-label="Redeschide întrebarea"
      >
        <span className="shrink-0">💬</span>
        <span className="truncate italic">"{interaction.selectedText.slice(0, 50)}{interaction.selectedText.length > 50 ? '…' : ''}"</span>
        {interaction.response && <span className="shrink-0 text-blue-500">— răspuns disponibil</span>}
      </motion.button>
    );
  }

  // ── Expanded mini-chat ────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="mt-3 border-l-4 border-blue-400 bg-blue-50/60 dark:bg-blue-950/30 rounded-r-lg overflow-hidden shadow-sm"
        aria-label="Mini-chat întrebare"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-blue-100/70 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800">
          <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">
            💬 Întrebare despre acest pas
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => toggleMinimize(interaction.id)}
              className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              title="Minimizează"
              aria-label="Minimizează"
            >
              <Minus className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
            </button>
            <button
              onClick={() => removeInteraction(interaction.id)}
              className="p-1 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              title="Șterge"
              aria-label="Șterge întrebarea"
            >
              <X className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 space-y-2.5">
          {/* Selected text quote */}
          <blockquote className="text-xs italic text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1.5 rounded border-l-2 border-gray-300 dark:border-gray-600">
            <span className="not-italic font-medium">Text selectat: </span>
            &ldquo;{interaction.selectedText}&rdquo;
          </blockquote>

          {/* Input area (only before first response) */}
          {!hasResponse && (
            <div className="space-y-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="Ce nu ai înțeles? (Enter pentru trimite)"
                rows={2}
                autoFocus
                disabled={isLoading}
                className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none disabled:opacity-60"
              />
              <button
                onClick={() => void handleSubmit()}
                disabled={isLoading || !inputValue.trim()}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {isLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />}
                Întreabă profesorul
              </button>
            </div>
          )}

          {/* Question + response (after submit) */}
          {hasResponse && (
            <>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                <span className="font-semibold">Întrebarea ta:</span> {interaction.question}
              </p>
              <div className="text-sm">
                <MessageRenderer content={interaction.response} isStreaming={interaction.isStreaming} />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
