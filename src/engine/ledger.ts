import { normalBalance, normalSide } from './accounts';
import { sortEntries } from './journal';
import type { Account, Cents, DateRange, ISODate, JournalEntry, Side } from './types';

export function inRange(date: ISODate, range: DateRange = {}): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function filterEntries(entries: JournalEntry[], range: DateRange = {}): JournalEntry[] {
  return entries.filter((e) => inRange(e.date, range));
}

export interface Activity {
  debit: Cents;
  credit: Cents;
}

/** Total debits and credits per account over the given entries. */
export function activityByAccount(entries: JournalEntry[]): Map<string, Activity> {
  const map = new Map<string, Activity>();
  for (const e of entries) {
    for (const l of e.lines) {
      const a = map.get(l.accountId) ?? { debit: 0, credit: 0 };
      a.debit += l.debit;
      a.credit += l.credit;
      map.set(l.accountId, a);
    }
  }
  return map;
}

export function accountHasActivity(accountId: string, entries: JournalEntry[]): boolean {
  return entries.some((e) => e.lines.some((l) => l.accountId === accountId));
}

export interface LedgerRow {
  entryId: string;
  entryLabel: string;
  seq: number;
  kind: JournalEntry['kind'];
  date: ISODate;
  description: string;
  debit: Cents;
  credit: Cents;
  /** Running balance in the account's normal direction. */
  balance: Cents;
}

export interface Ledger {
  account: Account;
  rows: LedgerRow[];
  totalDebit: Cents;
  totalCredit: Cents;
  balance: Cents;
}

/** General ledger for one account, chronologically, with running normal balance. */
export function ledgerFor(account: Account, entries: JournalEntry[], range: DateRange = {}): Ledger {
  const rows: LedgerRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of sortEntries(filterEntries(entries, range))) {
    for (const l of e.lines) {
      if (l.accountId !== account.id) continue;
      totalDebit += l.debit;
      totalCredit += l.credit;
      rows.push({
        entryId: e.id,
        entryLabel: e.kind === 'opening' ? 'OB' : `J${e.seq}`,
        seq: e.seq,
        kind: e.kind,
        date: e.date,
        description: e.description,
        debit: l.debit,
        credit: l.credit,
        balance: normalBalance(account, totalDebit, totalCredit),
      });
    }
  }
  return { account, rows, totalDebit, totalCredit, balance: normalBalance(account, totalDebit, totalCredit) };
}

export interface TItem {
  entryId: string;
  entryLabel: string;
  date: ISODate;
  description: string;
  amount: Cents;
}

export interface TAccount {
  account: Account;
  debits: TItem[];
  credits: TItem[];
  totalDebit: Cents;
  totalCredit: Cents;
  /** Ending balance (always ≥ 0) and the side it sits on. */
  balance: Cents;
  balanceSide: Side;
}

export function tAccount(account: Account, entries: JournalEntry[], range: DateRange = {}): TAccount {
  const ledger = ledgerFor(account, entries, range);
  const debits: TItem[] = [];
  const credits: TItem[] = [];
  for (const r of ledger.rows) {
    const base = { entryId: r.entryId, entryLabel: r.entryLabel, date: r.date, description: r.description };
    if (r.debit) debits.push({ ...base, amount: r.debit });
    if (r.credit) credits.push({ ...base, amount: r.credit });
  }
  const net = ledger.totalDebit - ledger.totalCredit;
  let balanceSide: Side;
  if (net > 0) balanceSide = 'debit';
  else if (net < 0) balanceSide = 'credit';
  else balanceSide = normalSide(account);
  return {
    account,
    debits,
    credits,
    totalDebit: ledger.totalDebit,
    totalCredit: ledger.totalCredit,
    balance: Math.abs(net),
    balanceSide,
  };
}
