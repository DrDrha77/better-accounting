/** All monetary amounts are integer cents. Dates are ISO strings: YYYY-MM-DD. */
export type Cents = number;
export type ISODate = string;

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type Side = 'debit' | 'credit';

export interface Account {
  id: string;
  number: number;
  name: string;
  type: AccountType;
  /** Contra accounts carry the opposite normal balance of their type (e.g. Owner's Drawings). */
  contra?: boolean;
  /** Stable key used by the parser so renaming an account doesn't break templates. */
  systemKey?: string;
  /** Classified balance sheet: current, or non-current (fixed asset / long-term liability). Auto-detected when unset. */
  group?: 'current' | 'noncurrent';
}

export interface JournalLine {
  accountId: string;
  debit: Cents;
  credit: Cents;
}

export type EntryKind = 'standard' | 'opening';

export interface JournalEntry {
  id: string;
  /** Stable entry number. The opening balance entry is always seq 0. */
  seq: number;
  date: ISODate;
  description: string;
  lines: JournalLine[];
  kind: EntryKind;
  /** The plain-English sentence the entry was parsed from, if any. */
  sourceText?: string;
  createdAt: number;
}

/** What the user submits; the store assigns id/seq/createdAt. */
export interface EntryDraft {
  date: ISODate;
  description: string;
  lines: JournalLine[];
  sourceText?: string;
}

export interface Books {
  accounts: Account[];
  entries: JournalEntry[];
  nextSeq: number;
}

export interface DateRange {
  from?: ISODate;
  to?: ISODate;
}
