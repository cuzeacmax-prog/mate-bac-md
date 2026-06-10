'use client';

import { motion } from 'framer-motion';
import { GraduationCap, Zap } from 'lucide-react';
import { useChatModeStore } from '@/lib/stores/chat-mode-store';

export function ModeToggle() {
  const { mode, setMode } = useChatModeStore();

  return (
    <div
      className="inline-flex items-center glass-1 rounded-full p-1 relative"
      role="group"
      aria-label="Mod chat"
    >
      {/* Sliding indicator */}
      <motion.div
        className="absolute top-1 bottom-1 bg-[var(--glass-3)] border border-[var(--glass-3-border)] rounded-full pointer-events-none"
        initial={false}
        animate={{ left: mode === 'study' ? 4 : '50%' }}
        style={{ width: 'calc(50% - 4px)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      />

      <button
        onClick={() => setMode('study')}
        aria-pressed={mode === 'study'}
        className={[
          'relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          mode === 'study' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
        ].join(' ')}
      >
        <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Study</span>
      </button>

      <button
        onClick={() => setMode('solve')}
        aria-pressed={mode === 'solve'}
        className={[
          'relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          mode === 'solve' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
        ].join(' ')}
      >
        <Zap className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Solve</span>
      </button>
    </div>
  );
}
