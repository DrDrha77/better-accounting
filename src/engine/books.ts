/**
 * Pure state transitions for the books (chart of accounts + journal).
 * The Zustand store wraps these; keeping them here makes them unit-testable.
 * Every function returns either new books or a list of errors — never a partially-applied change.
 */
import { DEFAULT_ACCOUNTS, typeForNumber } from './accounts';
import { newId, validateEntry } from './journal';
import { accountHasActivity } from './ledger';
import { OPENING_DESCRIPTION, openingLines, validateOpening, type OpeningBalanceInput } from './opening';
import type { Account, AccountType, Books, EntryDraft, JournalEntry } from './types';

export type Result = { ok: true; books: Books; id?: string } | { ok: false; errors: string[] };

export function emptyBooks(): Books {
  return { accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })), entries: [], nextSeq: 1 };
}

export function addEntry(books: Books, draft: EntryDraft, now = Date.now()): Result {
  const v = validateEntry(draft, books.accounts);
  if (!v.ok) return { ok: false, errors: v.errors };
  const entry: JournalEntry = {
    id: newId(),
    seq: books.nextSeq,
    date: draft.date,
    description: draft.description.trim(),
    lines: draft.lines.map((l) => ({ ...l })),
    kind: 'standard',
    ...(draft.sourceText ? { sourceText: draft.sourceText } : {}),
    createdAt: now,
  };
  return { ok: true, id: entry.id, books: { ...books, entries: [...books.entries, entry], nextSeq: books.nextSeq + 1 } };
}

export function updateEntry(books: Books, id: string, draft: EntryDraft): Result {
  const existing = books.entries.find((e) => e.id === id);
  if (!existing) return { ok: false, errors: ['Entry not found.'] };
  const v = validateEntry(draft, books.accounts);
  if (!v.ok) return { ok: false, errors: v.errors };
  const updated: JournalEntry = {
    ...existing,
    date: draft.date,
    description: draft.description.trim(),
    lines: draft.lines.map((l) => ({ ...l })),
  };
  return { ok: true, id, books: { ...books, entries: books.entries.map((e) => (e.id === id ? updated : e)) } };
}

export function deleteEntry(books: Books, id: string): Result {
  if (!books.entries.some((e) => e.id === id)) return { ok: false, errors: ['Entry not found.'] };
  return { ok: true, books: { ...books, entries: books.entries.filter((e) => e.id !== id) } };
}

/** Create or replace the single opening-balance entry (always entry seq 0). */
export function saveOpening(books: Books, input: OpeningBalanceInput, now = Date.now()): Result {
  const v = validateOpening(input, books.accounts);
  if (!v.ok) return { ok: false, errors: v.errors };
  const existing = books.entries.find((e) => e.kind === 'opening');
  const entry: JournalEntry = {
    id: existing?.id ?? newId(),
    seq: 0,
    date: input.date,
    description: OPENING_DESCRIPTION,
    lines: openingLines(input),
    kind: 'opening',
    createdAt: existing?.createdAt ?? now,
  };
  const others = books.entries.filter((e) => e.kind !== 'opening');
  return { ok: true, id: entry.id, books: { ...books, entries: [entry, ...others] } };
}

export function removeOpening(books: Books): Result {
  return { ok: true, books: { ...books, entries: books.entries.filter((e) => e.kind !== 'opening') } };
}

export interface NewAccount {
  number: number;
  name: string;
  type: AccountType;
  contra?: boolean;
}

export function addAccount(books: Books, input: NewAccount): Result {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push('Enter an account name.');
  if (!Number.isInteger(input.number) || input.number <= 0) errors.push('Enter a whole account number.');
  else if (typeForNumber(input.number) !== input.type)
    errors.push(`Account number ${input.number} is outside the ${input.type} range.`);
  if (books.accounts.some((a) => a.number === input.number)) errors.push(`Account number ${input.number} is already used.`);
  if (books.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) errors.push(`An account named "${name}" already exists.`);
  if (errors.length) return { ok: false, errors };
  const account: Account = { id: newId(), number: input.number, name, type: input.type, ...(input.contra ? { contra: true } : {}) };
  return { ok: true, id: account.id, books: { ...books, accounts: [...books.accounts, account] } };
}

export function renameAccount(books: Books, id: string, name: string): Result {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, errors: ['Enter an account name.'] };
  if (!books.accounts.some((a) => a.id === id)) return { ok: false, errors: ['Account not found.'] };
  if (books.accounts.some((a) => a.id !== id && a.name.toLowerCase() === trimmed.toLowerCase()))
    return { ok: false, errors: [`An account named "${trimmed}" already exists.`] };
  return { ok: true, books: { ...books, accounts: books.accounts.map((a) => (a.id === id ? { ...a, name: trimmed } : a)) } };
}

export function deleteAccount(books: Books, id: string): Result {
  if (accountHasActivity(id, books.entries))
    return { ok: false, errors: ["This account has transactions and can't be deleted."] };
  return { ok: true, books: { ...books, accounts: books.accounts.filter((a) => a.id !== id) } };
}
