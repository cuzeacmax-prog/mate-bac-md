'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Target, MessageCircle } from 'lucide-react';
import { useInteractionsStore } from '@/lib/stores/interactions-store';
import { useChatModeStore } from '@/lib/stores/chat-mode-store';
import { parseBlocks, blockTypeColor, type MessageBlock } from '@/lib/chat/block-parser';
import { InlineMiniChat } from '@/components/chat/InlineMiniChat';
import { MessageRenderer } from '@/app/app/chat/_components/MessageRenderer';

interface Props {
  messageId: string;
  content: string;
  isStreaming?: boolean;
}

export function BlockSelectableMessage({ messageId, content, isStreaming }: Props) {
  const { mode } = useChatModeStore();
  const { addInteraction, getForMessage } = useInteractionsStore();
  const [isBlockMode, setIsBlockMode] = useState(false);

  const { blocks, rawContent, hasBlocks } = parseBlocks(content);
  const interactions = getForMessage(messageId);

  // ── Solve mode or streaming: plain render ────────────────────────
  if (mode === 'solve' || isStreaming) {
    return <MessageRenderer content={rawContent || content} isStreaming={isStreaming} />;
  }

  // ── Study mode WITHOUT blocks: plain render, no interaction ──────
  if (!hasBlocks) {
    return <MessageRenderer content={content} />;
  }

  // ── Study mode WITH blocks: block-click UI ────────────────────────
  function handleBlockClick(block: MessageBlock) {
    // Verifică dacă există deja un mini-chat pentru acest bloc
    const existing = interactions.find((i) => i.blockId === block.id);
    if (existing) {
      // Mini-chat-ul există deja — nu face nimic (e vizibil mai jos)
      setIsBlockMode(false);
      return;
    }

    addInteraction(messageId, {
      messageId,
      blockId: block.id,
      blockType: block.type,
      blockContent: block.content,
      selectedText: block.content.slice(0, 200), // primele 200 chars pentru preview
      question: '',
      response: '',
      isMinimized: false,
      isStreaming: false,
    });

    setIsBlockMode(false);
  }

  return (
    <div className="space-y-1">
      {/* Buton activare mod bloc */}
      <div className="flex justify-end mb-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsBlockMode((v) => !v)}
          aria-pressed={isBlockMode}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-blue-400',
            isBlockMode
              ? 'bg-blue-500 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/40'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300',
          ].join(' ')}
        >
          <Target className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {isBlockMode ? 'Selectează un pas ↓' : '🎯 Întreabă despre un pas'}
        </motion.button>
      </div>

      {/* Blocuri */}
      <div className="space-y-2">
        {blocks.map((block) => {
          const blockInteractions = interactions.filter((i) => i.blockId === block.id);
          const hasInteraction = blockInteractions.length > 0;
          const accentClass = blockTypeColor(block.type);

          return (
            <div key={block.id}>
              {/* Block container */}
              <motion.div
                layout="position"
                onClick={() => isBlockMode && handleBlockClick(block)}
                className={[
                  'relative rounded-lg px-4 py-3 transition-all duration-150',
                  isBlockMode
                    ? 'border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer'
                    : hasInteraction
                    ? `border-l-4 ${accentClass} bg-blue-50/20 dark:bg-blue-950/20`
                    : 'border-l-4 border-transparent',
                ].join(' ')}
                whileHover={isBlockMode ? { scale: 1.005 } : undefined}
                style={isBlockMode ? undefined : undefined}
              >
                {/* Hover label in block mode */}
                {isBlockMode && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    whileHover={{ opacity: 1, y: 0 }}
                    className="absolute -top-2 right-2 px-2 py-0.5 bg-blue-500 text-white text-[10px] font-medium rounded-full pointer-events-none"
                  >
                    💬 Click pentru întrebare
                  </motion.span>
                )}

                {/* Block content — rendered as Markdown+KaTeX */}
                <MessageRenderer content={block.content} />

                {/* Indicator mini-chat existent */}
                {hasInteraction && !isBlockMode && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-blue-500 dark:text-blue-400">
                    <MessageCircle className="w-3 h-3" aria-hidden="true" />
                    <span>
                      {blockInteractions.length === 1 ? '1 întrebare' : `${blockInteractions.length} întrebări`}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Mini-chat-uri pentru acest bloc */}
              <AnimatePresence>
                {blockInteractions.map((interaction) => (
                  <InlineMiniChat
                    key={interaction.id}
                    interaction={interaction}
                    messageId={messageId}
                  />
                ))}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
