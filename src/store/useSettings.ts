import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AiProvider } from '../engine/parser/aiShared';
import type { AiMode } from '../engine/parser/hybridParser';

export type ThemePref = 'system' | 'light' | 'dark';
export type StylePref = 'ledger' | 'glass';

interface SettingsState {
  aiProvider: AiProvider;
  /** The user's own API keys, one per provider. Kept only in this browser's localStorage. */
  apiKeys: Record<AiProvider, string>;
  aiMode: AiMode;
  theme: ThemePref;
  /** Look of the app: "Classic ledger" (lined paper, top tabs) or "Liquid glass" (ocean, sidebar). */
  style: StylePref;
  setProvider(p: AiProvider): void;
  setApiKey(p: AiProvider, key: string): void;
  setAiMode(mode: AiMode): void;
  setTheme(theme: ThemePref): void;
  setStyle(style: StylePref): void;
}

type Persisted = Pick<SettingsState, 'aiProvider' | 'apiKeys' | 'aiMode' | 'theme' | 'style'>;

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      aiProvider: 'gemini',
      apiKeys: { gemini: '', anthropic: '' },
      aiMode: 'fallback',
      theme: 'system',
      style: 'ledger',
      setProvider: (aiProvider) => set({ aiProvider }),
      setApiKey: (p, key) => set((s) => ({ apiKeys: { ...s.apiKeys, [p]: key.trim() } })),
      setAiMode: (aiMode) => set({ aiMode }),
      setTheme: (theme) => set({ theme }),
      setStyle: (style) => set({ style }),
    }),
    {
      name: 'better-accounting:settings',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Persisted => ({ aiProvider: s.aiProvider, apiKeys: s.apiKeys, aiMode: s.aiMode, theme: s.theme, style: s.style }),
      // v1 stored a single Anthropic key; v3 added the style choice (defaults to the classic ledger look).
      migrate: (persisted, version) => {
        let p = persisted as Partial<Persisted> & { anthropicApiKey?: string };
        if (version < 2) {
          p = {
            aiProvider: p.anthropicApiKey ? 'anthropic' : 'gemini',
            apiKeys: { gemini: '', anthropic: p.anthropicApiKey ?? '' },
            aiMode: p.aiMode ?? 'fallback',
            theme: 'system',
          };
        }
        return { ...p, style: p.style ?? 'ledger' } as Persisted;
      },
    },
  ),
);
