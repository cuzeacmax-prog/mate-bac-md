'use client';

import { create } from 'zustand';

export interface Interaction {
  id: string;
  messageId: string;
  /** Id-ul blocului [[BLOCK:id:type]] (prezent în block selection mode) */
  blockId?: string;
  /** Tipul blocului: DVA, transform, solve, verify, final, hint… */
  blockType?: string;
  /** Conținut complet al blocului selectat */
  blockContent?: string;
  selectedText: string;
  question: string;
  response: string;
  isMinimized: boolean;
  isStreaming: boolean;
  createdAt: Date;
}

type InteractionInput = Omit<Interaction, 'id' | 'createdAt'>;

interface InteractionsStore {
  /** Keyed by messageId */
  interactions: Record<string, Interaction[]>;

  addInteraction: (messageId: string, data: InteractionInput) => string;
  updateInteraction: (id: string, updates: Partial<Interaction>) => void;
  removeInteraction: (id: string) => void;
  toggleMinimize: (id: string) => void;
  getForMessage: (messageId: string) => Interaction[];
}

export const useInteractionsStore = create<InteractionsStore>((set, get) => ({
  interactions: {},

  addInteraction: (messageId, data) => {
    const id = crypto.randomUUID();
    const interaction: Interaction = { ...data, id, createdAt: new Date() };
    set((state) => ({
      interactions: {
        ...state.interactions,
        [messageId]: [...(state.interactions[messageId] ?? []), interaction],
      },
    }));
    return id;
  },

  updateInteraction: (id, updates) => {
    set((state) => {
      const next = { ...state.interactions };
      for (const msgId of Object.keys(next)) {
        const idx = next[msgId].findIndex((i) => i.id === id);
        if (idx >= 0) {
          next[msgId] = next[msgId].map((i) => (i.id === id ? { ...i, ...updates } : i));
          break;
        }
      }
      return { interactions: next };
    });
  },

  removeInteraction: (id) => {
    set((state) => {
      const next = { ...state.interactions };
      for (const msgId of Object.keys(next)) {
        next[msgId] = next[msgId].filter((i) => i.id !== id);
      }
      return { interactions: next };
    });
  },

  toggleMinimize: (id) => {
    const all = Object.values(get().interactions).flat();
    const target = all.find((i) => i.id === id);
    if (target) get().updateInteraction(id, { isMinimized: !target.isMinimized });
  },

  getForMessage: (messageId) => get().interactions[messageId] ?? [],
}));
