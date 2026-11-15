/**
 * Saved journals: named snapshots of a company's journal (entries, opening balance and the chart of
 * accounts they use) that can be restored later. Pure functions; the app stores them per company.
 */
import { suggestAccountNumber } from './accounts';
import { newId } from './journal';
import type { Account, Books, JournalEntry } from './types';

export interface SavedJournal {
  id: string;
  name: string;
  savedAt: string;
  /** Journal entries excluding the opening balance, for display. */
  entryCount: number;
  accounts: Account[];
  entries: JournalEntry[];
  nextSeq: number;
}

export function defaultJournalName(now: Date): string {
  return `Journal · ${now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}

export function makeSavedJournal(books: Books, name: string, now: Date = new Date()): SavedJournal {
  return {
    id: newId(),
    name: name.trim() || defaultJournalName(now),
    savedAt: now.toISOString(),
    entryCount: books.entries.filter((e) => e.kind !== 'opening').length,
    // Deep copies so later edits to the live books can't change the snapshot.
    accounts: JSON.parse(JSON.stringify(books.accounts)),
    entries: JSON.parse(JSON.stringify(books.entries)),
    nextSeq: books.nextSeq,
  };
}

/**
 * Put a saved journal's entries back into the books. The current chart of accounts is kept; an
 * account the snapshot used that no longer exists is matched to a same-named (or same system) account
 * if there is one, or added back, so every restored entry points at a real account.
 */
export function restoreSavedJournal(current: Books, saved: SavedJournal): Books {
  const accounts = [...current.accounts];
  const have = new Set(accounts.map((a) => a.id));
  const remap = new Map<string, string>();
  const used = new Set(saved.entries.flatMap((e) => e.lines.map((l) => l.accountId)));

  for (const a of saved.accounts) {
    if (!used.has(a.id) || have.has(a.id)) continue;
    const twin = accounts.find((x) => (a.systemKey && x.systemKey === a.systemKey) || (x.name.toLowerCase() === a.name.toLowerCase() && x.type === a.type));
    if (twin) {
      remap.set(a.id, twin.id);
      continue;
    }
    const taken = accounts.some((x) => x.number === a.number);
    const restored: Account = { ...a, number: taken ? suggestAccountNumber(accounts, a.type) : a.number };
    accounts.push(restored);
    have.add(restored.id);
  }

  const entries: JournalEntry[] = saved.entries.map((e) => ({
    ...e,
    lines: e.lines.map((l) => ({ ...l, accountId: remap.get(l.accountId) ?? l.accountId })),
  }));
  const maxSeq = entries.filter((e) => e.kind !== 'opening').reduce((m, e) => Math.max(m, e.seq), 0);
  return { accounts, entries, nextSeq: Math.max(saved.nextSeq, maxSeq + 1) };
}
