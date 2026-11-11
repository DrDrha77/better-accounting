import type { Account, Cents, EntryDraft, JournalEntry, JournalLine } from './types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function lineTotals(lines: JournalLine[]): { debit: Cents; credit: Cents; difference: Cents } {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    debit += l.debit;
    credit += l.credit;
  }
  return { debit, credit, difference: debit - credit };
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Validate a journal entry. An entry that fails validation can never be saved. */
export function validateEntry(draft: Pick<EntryDraft, 'date' | 'description' | 'lines'>, accounts: Account[]): ValidationResult {
  const errors: string[] = [];
  const ids = new Set(accounts.map((a) => a.id));

  if (!isValidISODate(draft.date)) errors.push('Enter a valid date.');
  if (!draft.description.trim()) errors.push('Enter a description.');

  const lines = draft.lines;
  if (lines.length < 2) errors.push('An entry needs at least two lines.');

  lines.forEach((l, i) => {
    const n = i + 1;
    if (!ids.has(l.accountId)) errors.push(`Line ${n}: choose an account.`);
    for (const v of [l.debit, l.credit]) {
      if (!Number.isInteger(v) || v < 0) errors.push(`Line ${n}: amounts must be positive and in whole cents.`);
    }
    if (l.debit > 0 && l.credit > 0) errors.push(`Line ${n}: a line can't have both a debit and a credit.`);
    if (l.debit === 0 && l.credit === 0) errors.push(`Line ${n}: enter a debit or a credit amount.`);
  });

  const { debit, credit } = lineTotals(lines);
  if (!lines.some((l) => l.debit > 0)) errors.push('An entry needs at least one debit.');
  if (!lines.some((l) => l.credit > 0)) errors.push('An entry needs at least one credit.');
  if (debit !== credit) errors.push('Debits must equal credits.');

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

/** Chronological order: date, then the opening entry first, then entry number. */
export function compareEntries(a: JournalEntry, b: JournalEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === 'opening' ? -1 : 1;
  return a.seq - b.seq;
}

export function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort(compareEntries);
}

export function entryNumberLabel(e: JournalEntry): string {
  return e.kind === 'opening' ? 'OB' : `J${e.seq}`;
}

export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function debitLine(accountId: string, amount: Cents): JournalLine {
  return { accountId, debit: amount, credit: 0 };
}

export function creditLine(accountId: string, amount: Cents): JournalLine {
  return { accountId, debit: 0, credit: amount };
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
