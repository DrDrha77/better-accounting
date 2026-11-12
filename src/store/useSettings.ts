import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AiMode } from '../engine/parser/hybridParser';

interface SettingsState {
  /** The user's own Anthropic API key. Kept only in this browser's localStorage. */
  anthropicApiKey: string;
  aiMode: AiMode;
  setApiKey(key: string): void;
  setAiMode(mode: AiMode): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      anthropicApiKey: '',
      aiMode: 'fallback',
      setApiKey: (key) => set({ anthropicApiKey: key.trim() }),
      setAiMode: (aiMode) => set({ aiMode }),
    }),
    {
      name: 'better-accounting:settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ anthropicApiKey: s.anthropicApiKey, aiMode: s.aiMode }),
    },
  ),
);
