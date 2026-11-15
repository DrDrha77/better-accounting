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

export type TabPosition = 'top' | 'side';
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export type AccentPref = 'default' | 'blue' | 'purple' | 'orange' | 'pink';
export type DensityPref = 'comfortable' | 'compact';

interface SettingsState {
  /** Where the page tabs go: along the top bar or in a left side bar (wide screens). */
  tabPosition: TabPosition;
  textSize: TextSize;
  /** Highlight color. 'default' follows the design (green for Classic, blue for Apple). */
  accent: AccentPref;
  density: DensityPref;
  /** Paths of tabs the user turned off, like '/t-accounts'. Settings can't be hidden. */
  hiddenTabs: string[];
  /** The page the app opens on. */
  startPage: string;
  aiProvider: AiProvider;
  /** The user's own API keys, one per provider. Kept only in this browser's localStorage. */
  apiKeys: Record<AiProvider, string>;
  aiMode: AiMode;
  theme: ThemePref;
  style: StylePref;
  design: DesignPref;
  /**
   * @deprecated These four used to be app-wide. They are now per company (see useCompanies / useCompany)
   * and are kept here only so the first company can be seeded from what an older version saved.
   */
  companyName: string;
  /** @deprecated per company: useCompany */
  entryDate: string;
  /** @deprecated per company: useCompany */
  periodFrom: string;
  /** @deprecated per company: useCompany */
  lastBackupAt: string;
  setProvider(p: AiProvider): void;
  setApiKey(p: AiProvider, key: string): void;
  setAiMode(mode: AiMode): void;
  setTheme(theme: ThemePref): void;
  setStyle(style: StylePref): void;
  setDesign(design: DesignPref): void;
  setTabPosition(v: TabPosition): void;
  setTextSize(v: TextSize): void;
  setAccent(v: AccentPref): void;
  setDensity(v: DensityPref): void;
  setTabHidden(path: string, hidden: boolean): void;
  setStartPage(path: string): void;
}

type Persisted = Pick<SettingsState, 'tabPosition' | 'textSize' | 'accent' | 'density' | 'hiddenTabs' | 'startPage' | 'aiProvider' | 'apiKeys' | 'aiMode' | 'theme' | 'style' | 'design' | 'companyName' | 'entryDate' | 'periodFrom' | 'lastBackupAt'>;

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      tabPosition: 'top',
      textSize: 'md',
      accent: 'default',
      density: 'comfortable',
      hiddenTabs: [],
      startPage: '/add',
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
      setTabPosition: (tabPosition) => set({ tabPosition }),
      setTextSize: (textSize) => set({ textSize }),
      setAccent: (accent) => set({ accent }),
      setDensity: (density) => set({ density }),
      setTabHidden: (path, hidden) =>
        set((s) => ({ hiddenTabs: hidden ? [...new Set([...s.hiddenTabs, path])] : s.hiddenTabs.filter((p) => p !== path) })),
      setStartPage: (startPage) => set({ startPage }),
    }),
    {
      name: 'better-accounting:settings',
      version: 7,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s): Persisted => ({
        tabPosition: s.tabPosition,
        textSize: s.textSize,
        accent: s.accent,
        density: s.density,
        hiddenTabs: s.hiddenTabs,
        startPage: s.startPage,
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
          // v7 added layout customization; everyone starts with the defaults.
          tabPosition: p.tabPosition === 'side' ? 'side' : 'top',
          textSize: p.textSize ?? 'md',
          accent: p.accent ?? 'default',
          density: p.density ?? 'comfortable',
          hiddenTabs: Array.isArray(p.hiddenTabs) ? p.hiddenTabs : [],
          startPage: p.startPage ?? '/add',
        } as Persisted;
      },
    },
  ),
);

/** The date new entries start on: the saved default, or today. */
export function defaultEntryDate(entryDate: string, today: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(entryDate) ? entryDate : today;
}
