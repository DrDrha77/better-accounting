import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { withMissingDefaults } from '../engine/accounts';
import * as ops from '../engine/books';
import type { OpeningBalanceInput } from '../engine/opening';
import { buildSampleBooks } from '../engine/sample';
import { safeLocalStorage } from './safeStorage';
import type { Books, EntryDraft } from '../engine/types';

export type ActionResult = { ok: true; id?: string } | { ok: false; errors: string[] };

interface BooksState extends Books {
  addEntry(draft: EntryDraft): ActionResult;
  updateEntry(id: string, draft: EntryDraft): ActionResult;
  deleteEntry(id: string): ActionResult;
  clearJournal(): ActionResult;
  saveOpening(input: OpeningBalanceInput): ActionResult;
  removeOpening(): ActionResult;
  addAccount(input: ops.NewAccount): ActionResult;
  renameAccount(id: string, name: string): ActionResult;
  deleteAccount(id: string): ActionResult;
  loadSample(): void;
  reset(): void;
  /** Replace everything with a validated backup. */
  restore(books: Books): void;
}

const pickBooks = (s: Books): Books => ({ accounts: s.accounts, entries: s.entries, nextSeq: s.nextSeq });

export const useBooks = create<BooksState>()(
  persist(
    (set, get) => {
      /** Apply a pure engine transition; only commit when it succeeds. */
      const apply = (fn: (b: Books) => ops.Result): ActionResult => {
        const r = fn(pickBooks(get()));
        if (!r.ok) return r;
        set(r.books);
        return { ok: true, id: r.id };
      };
      return {
        ...ops.emptyBooks(),
        addEntry: (d) => apply((b) => ops.addEntry(b, d)),
        updateEntry: (id, d) => apply((b) => ops.updateEntry(b, id, d)),
        deleteEntry: (id) => apply((b) => ops.deleteEntry(b, id)),
        clearJournal: () => apply((b) => ops.clearJournal(b)),
        saveOpening: (input) => apply((b) => ops.saveOpening(b, input)),
        removeOpening: () => apply((b) => ops.removeOpening(b)),
        addAccount: (input) => apply((b) => ops.addAccount(b, input)),
        renameAccount: (id, name) => apply((b) => ops.renameAccount(b, id, name)),
        deleteAccount: (id) => apply((b) => ops.deleteAccount(b, id)),
        loadSample: () => set(buildSampleBooks()),
        reset: () => set(ops.emptyBooks()),
        restore: (books) => set({ accounts: books.accounts, entries: books.entries, nextSeq: books.nextSeq }),
      };
    },
    {
      name: 'better-accounting:books',
      version: 2,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => pickBooks(s),
      // v2 added default accounts (Vehicles, Furniture, Advertising, …); give saved books the ones they lack.
      migrate: (persisted) => {
        const books = persisted as Books;
        return { ...books, accounts: withMissingDefaults(books.accounts ?? []) } as BooksState;
      },
    },
  ),
);
