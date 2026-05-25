'use client';

import { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import { useInteractionsStore } from '@/lib/stores/interactions-store';
import { useChatModeStore } from '@/lib/stores/chat-mode-store';
import { InlineMiniChat } from '@/components/chat/InlineMiniChat';
import { MessageRenderer } from '@/app/app/chat/_components/MessageRenderer';

interface Props {
  messageId: string;
  content: string;
  isStreaming?: boolean;
}

interface SelectionPopup {
  text: string;
  /** Viewport-relative position for the floating popup */
  top: number;
  left: number;
}

export function SelectableMessage({ messageId, content, isStreaming }: Props) {
  const { mode } = useChatModeStore();
  const { addInteraction, getForMessage } = useInteractionsStore();

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [popup, setPopup] = useState<SelectionPopup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const interactions = getForMessage(messageId);

  // ── Handle text selection (mouseup) ──────────────────────────────
  const handleMouseUp = useCallback(() => {
    if (!isSelectMode) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (!text || text.length < 3) {
      setPopup(null);
      return;
    }

    try {
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPopup({
        text,
        top: rect.bottom + window.scrollY + 8,
        left: Math.max(8, rect.left + window.scrollX),
      });
    } catch {
      setPopup(null);
    }
  }, [isSelectMode]);

  // ── Confirm selection → create mini-chat ─────────────────────────
  const handleConfirm = useCallback(() => {
    if (!popup) return;

    addInteraction(messageId, {
      messageId,
      selectedText: popup.text,
      question: '',
      response: '',
      isMinimized: false,
      isStreaming: false,
    });

    setPopup(null);
    setIsSelectMode(false);
    window.getSelection()?.removeAllRanges();
  }, [popup, messageId, addInteraction]);

  // ── Dismiss popup when clicking outside ─────────────────────────
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Check if click is inside a popup button (handled separately)
    if ((e.target as HTMLElement).closest('[data-popup-action]')) return;
    setPopup(null);
  }, []);

  // ── SOLVE MODE: no selection, plain render ────────────────────────
  if (mode === 'solve') {
    return (
      <MessageRenderer content={content} isStreaming={isStreaming} />
    );
  }

  // ── STUDY MODE ────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Select-mode toggle button */}
      {!isStreaming && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setIsSelectMode((v) => !v);
              setPopup(null);
              if (isSelectMode) window.getSelection()?.removeAllRanges();
            }}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-400',
              isSelectMode
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300',
            ].join(' ')}
            aria-pressed={isSelectMode}
            title={isSelectMode ? 'Selectează textul de mai jos' : 'Activează selecție pentru întrebare'}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
            {isSelectMode ? 'Selectează text…' : '🎯 Întreabă despre un pas'}
          </button>
        </div>
      )}

      {/* Message content */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onClick={handleContainerClick}
        className={isSelectMode ? 'cursor-text select-text' : ''}
        aria-label={isSelectMode ? 'Selectează textul despre care ai întrebări' : undefined}
      >
        <MessageRenderer content={content} isStreaming={isStreaming} />
      </div>

      {/* Floating popup after text selection */}
      <AnimatePresence>
        {popup && (
          <motion.div
            key="selection-popup"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: popup.top,
              left: popup.left,
              zIndex: 9999,
            }}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2"
          >
            <span className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate italic">
              &ldquo;{popup.text.slice(0, 60)}{popup.text.length > 60 ? '…' : ''}&rdquo;
            </span>
            <button
              data-popup-action="confirm"
              onClick={handleConfirm}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-md transition-colors shrink-0"
            >
              💬 Întreabă
            </button>
            <button
              data-popup-action="dismiss"
              onClick={() => { setPopup(null); window.getSelection()?.removeAllRanges(); }}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Anulează selecția"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini-chats — listed below message content */}
      {interactions.length > 0 && (
        <div className="mt-1 space-y-1" aria-label="Întrebări per etapă">
          {interactions.map((interaction) => (
            <InlineMiniChat
              key={interaction.id}
              interaction={interaction}
              messageId={messageId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
