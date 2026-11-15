import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { activeCompanyStorage, companyDataKey } from './companyStorage';
import { useSettings } from './useSettings';

interface CompanyState {
  /** Default date for new entries ("Save for date"); empty means today. */
  entryDate: string;
  /** Start of the reporting period (Journal and Income Statement "From"); empty means from the beginning. */
  periodFrom: string;
  /** When this company's books were last downloaded as a backup (ISO timestamp); empty if never. */
  lastBackupAt: string;
  setEntryDate(date: string): void;
  setPeriodFrom(date: string): void;
  setLastBackupAt(at: string): void;
}

export const COMPANY_DEFAULTS = { entryDate: '', periodFrom: '', lastBackupAt: '' };

/** Per-company preferences, stored under the active company's key. */
export const useCompany = create<CompanyState>()(
  persist(
    (set) => {
      // The first company starts from what an older version saved app-wide.
      const legacy = useSettings.getState();
      return {
        entryDate: legacy.entryDate,
        periodFrom: legacy.periodFrom,
        lastBackupAt: legacy.lastBackupAt,
        setEntryDate: (entryDate) => set({ entryDate }),
        setPeriodFrom: (periodFrom) => set({ periodFrom }),
        setLastBackupAt: (lastBackupAt) => set({ lastBackupAt }),
      };
    },
    {
      name: 'better-accounting:company',
      version: 1,
      storage: createJSONStorage(() => activeCompanyStorage(companyDataKey)),
      partialize: (s) => ({ entryDate: s.entryDate, periodFrom: s.periodFrom, lastBackupAt: s.lastBackupAt }),
    },
  ),
);
