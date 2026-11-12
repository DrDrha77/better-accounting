import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AiProvider } from '../engine/parser/aiShared';
import type { AiMode } from '../engine/parser/hybridParser';

export type ThemePref = 'system' | 'light' | 'dark';

interface SettingsState {
  aiProvider: AiProvider;
  /** The user's own API keys, one per provider. Kept only in this browser's localStorage. */
  apiKeys: Record<AiProvider, string>;
  aiMode: AiMode;
  theme: ThemePref;
  setProvider(p: AiProvider): void;
  setApiKey(p: AiProvider, key: string): void;
  setAiMode(mode: AiMode): void;
  setTheme(theme: ThemePref): void;
}

type Persisted = Pick<SettingsState, 'aiProvider' | 'apiKeys' | 'aiMode' | 'theme'>;

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      aiProvider: 'gemini',
      apiKeys: { gemini: '', anthropic: '' },
      aiMode: 'fallback',
      theme: 'system',
      setProvider: (aiProvider) => set({ aiProvider }),
      setApiKey: (p, key) => set((s) => ({ apiKeys: { ...s.apiKeys, [p]: key.trim() } })),
      setAiMode: (aiMode) => set({ aiMode }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'better-accounting:settings',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Persisted => ({ aiProvider: s.aiProvider, apiKeys: s.apiKeys, aiMode: s.aiMode, theme: s.theme }),
      // v1 stored a single Anthropic key.
      migrate: (persisted, version) => {
        if (version < 2) {
          const old = persisted as { anthropicApiKey?: string; aiMode?: AiMode };
          return {
            aiProvider: old.anthropicApiKey ? 'anthropic' : 'gemini',
            apiKeys: { gemini: '', anthropic: old.anthropicApiKey ?? '' },
            aiMode: old.aiMode ?? 'fallback',
            theme: 'system',
          } satisfies Persisted;
        }
        return persisted as Persisted;
      },
    },
  ),
);
