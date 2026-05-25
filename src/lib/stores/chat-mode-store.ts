'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChatMode = 'study' | 'solve';

interface ChatModeStore {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  toggleMode: () => void;
}

export const useChatModeStore = create<ChatModeStore>()(
  persist(
    (set, get) => ({
      mode: 'study',
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === 'study' ? 'solve' : 'study' }),
    }),
    { name: 'mate-bac-md-chat-mode' }
  )
);
