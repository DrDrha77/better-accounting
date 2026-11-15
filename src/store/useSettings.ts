import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AiProvider } from '../engine/parser/aiShared';
import type { AiMode } from '../engine/parser/hybridParser';
import { safeLocalStorage } from './safeStorage';

export type ThemePref = 'system' | 'light' | 'dark';
/** Page background for the classic design: soft mint gradient (default) or faintly lined notebook paper. */
export type StylePref = 'gradient' | 'ledger';
/** The whole look of the app: the classic mint/serif design, or a clean Apple-style design. */
export type DesignPref = 'classic' | 'apple';

interface SettingsState {
  aiProvider: AiProvider;
  /** The user's own API keys, one per provider. Kept only in this browser's localStorage. */
  apiKeys: Record<AiProvider, string>;
  aiMode: AiMode;
  theme: ThemePref;
  style: StylePref;
  design: DesignPref;
  /** Shown at the top of financial statements. */
  companyName: string;
  /** Default date for new entries ("Save for date"); empty means today. */
  entryDate: string;
  /** Start of the reporting period (Journal and Income Statement "From"); empty means from the beginning. */
  periodFrom: string;
  /** When the books were last downloaded as a backup (ISO timestamp); empty if never. */
  lastBackupAt: string;
  setProvider(p: AiProvider): void;
  setApiKey(p: AiProvider, key: string): void;
  setAiMode(mode: AiMode): void;
  setTheme(theme: ThemePref): void;
  setStyle(style: StylePref): void;
  setDesign(design: DesignPref): void;
  setCompanyName(name: string): void;
  setEntryDate(date: string): void;
  setPeriodFrom(date: string): void;
  setLastBackupAt(at: string): void;
}

type Persisted = Pick<SettingsState, 'aiProvider' | 'apiKeys' | 'aiMode' | 'theme' | 'style' | 'design' | 'companyName' | 'entryDate' | 'periodFrom' | 'lastBackupAt'>;

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      aiProvider: 'gemini',
      apiKeys: { gemini: '', anthropic: '' },
      aiMode: 'fallback',
      theme: 'system',
      style: 'gradient',
      design: 'classic',
      companyName: '',
      entryDate: '',
      periodFrom: '',
      lastBackupAt: '',
      setProvider: (aiProvider) => set({ aiProvider }),
      setApiKey: (p, key) => set((s) => ({ apiKeys: { ...s.apiKeys, [p]: key.trim() } })),
      setAiMode: (aiMode) => set({ aiMode }),
      setTheme: (theme) => set({ theme }),
      setStyle: (style) => set({ style }),
      setDesign: (design) => set({ design }),
      setCompanyName: (companyName) => set({ companyName: companyName.trim() }),
      setEntryDate: (entryDate) => set({ entryDate }),
      setPeriodFrom: (periodFrom) => set({ periodFrom }),
      setLastBackupAt: (lastBackupAt) => set({ lastBackupAt }),
    }),
    {
      name: 'better-accounting:settings',
      version: 6,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s): Persisted => ({
        aiProvider: s.aiProvider,
        apiKeys: s.apiKeys,
        aiMode: s.aiMode,
        theme: s.theme,
        style: s.style,
        design: s.design,
        companyName: s.companyName,
        entryDate: s.entryDate,
        periodFrom: s.periodFrom,
        lastBackupAt: s.lastBackupAt,
      }),
      // v1: a single Anthropic key. v3: style was "ledger"/"glass". v4: "gradient" (new default) or "ledger".
      migrate: (persisted, version) => {
        let p = persisted as Partial<Persisted> & { anthropicApiKey?: string; style?: string };
        if (version < 2) {
          p = {
            aiProvider: p.anthropicApiKey ? 'anthropic' : 'gemini',
            apiKeys: { gemini: '', anthropic: p.anthropicApiKey ?? '' },
            aiMode: p.aiMode ?? 'fallback',
            theme: 'system',
          };
        }
        return {
          ...p,
          // Everyone moves to the new gradient look; lined paper is one click away in Settings.
          style: version < 4 ? 'gradient' : p.style === 'ledger' ? 'ledger' : 'gradient',
          companyName: p.companyName ?? '',
          entryDate: p.entryDate ?? '',
          periodFrom: p.periodFrom ?? '',
          lastBackupAt: p.lastBackupAt ?? '',
          // v6 added the design choice; everyone keeps the classic look until they pick another.
          design: p.design === 'apple' ? 'apple' : 'classic',
        } as Persisted;
      },
    },
  ),
);

/** The date new entries start on: the saved default, or today. */
export function defaultEntryDate(entryDate: string, today: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(entryDate) ? entryDate : today;
}
