import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeLocalStorage } from './safeStorage';
import { useSettings } from './useSettings';

export interface CompanyMeta {
  id: string;
  name: string;
}

/** The first company keeps the id older versions implicitly used, so their saved books are found as-is. */
export const MAIN_COMPANY_ID = 'main';
export const DEFAULT_COMPANY_NAME = 'My company';

interface CompaniesState {
  companies: CompanyMeta[];
  activeId: string;
  setActive(id: string): void;
  addCompany(c: CompanyMeta): void;
  renameCompany(id: string, name: string): void;
  removeCompany(id: string): void;
  /** Put a company back at a position (used by Undo). */
  insertCompany(c: CompanyMeta, index: number): void;
}

/** The registry of companies. Each company's own data lives under its own storage keys (see companyStorage). */
export const useCompanies = create<CompaniesState>()(
  persist(
    (set) => ({
      // Older versions had one anonymous company; its name was the "company name" setting.
      companies: [{ id: MAIN_COMPANY_ID, name: useSettings.getState().companyName.trim() || DEFAULT_COMPANY_NAME }],
      activeId: MAIN_COMPANY_ID,
      setActive: (activeId) => set({ activeId }),
      addCompany: (c) => set((s) => ({ companies: [...s.companies, c] })),
      renameCompany: (id, name) => set((s) => ({ companies: s.companies.map((c) => (c.id === id ? { ...c, name } : c)) })),
      removeCompany: (id) => set((s) => ({ companies: s.companies.filter((c) => c.id !== id) })),
      insertCompany: (c, index) =>
        set((s) => {
          const next = s.companies.filter((x) => x.id !== c.id);
          next.splice(Math.min(index, next.length), 0, c);
          return { companies: next };
        }),
    }),
    {
      name: 'better-accounting:companies',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ companies: s.companies, activeId: s.activeId }),
    },
  ),
);

/** A name nobody chose: the default, or a generated "Company 2". The scan may replace it with the name on the page. */
export function isPlaceholderName(name: string): boolean {
  return name === DEFAULT_COMPANY_NAME || /^Company \d+$/.test(name);
}

export function useCompanyName(): string {
  return useCompanies((s) => s.companies.find((c) => c.id === s.activeId)?.name ?? '');
}
