'use client';

import { motion } from 'framer-motion';
import { GraduationCap, Zap } from 'lucide-react';
import { useChatModeStore } from '@/lib/stores/chat-mode-store';

export function ModeToggle() {
  const { mode, setMode } = useChatModeStore();

  return (
    <div
      className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 relative"
      role="group"
      aria-label="Mod chat"
    >
      {/* Sliding indicator */}
      <motion.div
        className="absolute top-1 bottom-1 bg-white dark:bg-gray-700 rounded-md shadow-sm pointer-events-none"
        initial={false}
        animate={{ left: mode === 'study' ? 4 : '50%' }}
        style={{ width: 'calc(50% - 4px)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      />

      <button
        onClick={() => setMode('study')}
        aria-pressed={mode === 'study'}
        className={[
          'relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          mode === 'study'
            ? 'text-gray-900 dark:text-white font-semibold'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
        ].join(' ')}
      >
        <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Study</span>
      </button>

      <button
        onClick={() => setMode('solve')}
        aria-pressed={mode === 'solve'}
        className={[
          'relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          mode === 'solve'
            ? 'text-gray-900 dark:text-white font-semibold'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
        ].join(' ')}
      >
        <Zap className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Solve</span>
      </button>
    </div>
  );
}
