import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Books } from '../engine/types';
import { makeSavedJournal, type SavedJournal } from '../engine/savedJournals';
import { activeCompanyStorage, journalsKey } from './companyStorage';

interface SavedJournalsState {
  items: SavedJournal[];
  save(books: Books, name: string): SavedJournal;
  remove(id: string): void;
}

/** The active company's saved journals (named snapshots of its journal). */
export const useSavedJournals = create<SavedJournalsState>()(
  persist(
    (set, get) => ({
      items: [],
      save: (books, name) => {
        const saved = makeSavedJournal(books, name);
        set({ items: [saved, ...get().items] });
        return saved;
      },
      remove: (id) => set({ items: get().items.filter((j) => j.id !== id) }),
    }),
    {
      name: 'better-accounting:journals',
      version: 1,
      storage: createJSONStorage(() => activeCompanyStorage(journalsKey)),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);
