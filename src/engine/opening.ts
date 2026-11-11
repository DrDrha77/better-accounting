import { findBySystemKey, normalSide, SYSTEM_KEYS } from './accounts';
import { validateEntry, type ValidationResult } from './journal';
import type { Account, Cents, ISODate, JournalEntry, JournalLine, Side } from './types';

export interface OpeningBalanceLine {
  accountId: string;
  side: Side;
  amount: Cents;
}

export interface OpeningBalanceInput {
  date: ISODate;
  lines: OpeningBalanceLine[];
}

export const OPENING_DESCRIPTION = 'Opening Balance';

export function openingTotals(input: OpeningBalanceInput): { debit: Cents; credit: Cents; difference: Cents } {
  let debit = 0;
  let credit = 0;
  for (const l of input.lines) {
    if (l.side === 'debit') debit += l.amount;
    else credit += l.amount;
  }
  return { debit, credit, difference: debit - credit };
}

/** Convert opening input into journal lines (zero amounts dropped, one line per account). */
export function openingLines(input: OpeningBalanceInput): JournalLine[] {
  const net = new Map<string, Cents>();
  for (const l of input.lines) {
    if (!l.amount) continue;
    net.set(l.accountId, (net.get(l.accountId) ?? 0) + (l.side === 'debit' ? l.amount : -l.amount));
  }
  const lines: JournalLine[] = [];
  for (const [accountId, n] of net) {
    if (n > 0) lines.push({ accountId, debit: n, credit: 0 });
    else if (n < 0) lines.push({ accountId, debit: 0, credit: -n });
  }
  return lines;
}

export function validateOpening(input: OpeningBalanceInput, accounts: Account[]): ValidationResult {
  const result = validateEntry({ date: input.date, description: OPENING_DESCRIPTION, lines: openingLines(input) }, accounts);
  const { difference } = openingTotals(input);
  if (difference !== 0 && !result.errors.includes('Debits must equal credits.')) {
    result.errors.push('Debits must equal credits.');
    result.ok = false;
  }
  return result;
}

/**
 * Post any out-of-balance difference to Opening Balance Equity so the opening entry balances.
 * Returns a new input; the original is not modified.
 */
export function plugToOpeningBalanceEquity(input: OpeningBalanceInput, accounts: Account[]): OpeningBalanceInput {
  const obe = findBySystemKey(accounts, SYSTEM_KEYS.openingBalanceEquity);
  if (!obe) throw new Error('Opening Balance Equity account is missing from the chart of accounts.');
  const { difference } = openingTotals(input);
  if (difference === 0) return input;
  const others = input.lines.filter((l) => l.accountId !== obe.id);
  const obeNet = input.lines
    .filter((l) => l.accountId === obe.id)
    .reduce((s, l) => s + (l.side === 'debit' ? l.amount : -l.amount), 0);
  // Others' debit-minus-credit plus the new OBE net must be zero.
  const newNet = obeNet - difference;
  const lines = [...others];
  if (newNet !== 0) lines.push({ accountId: obe.id, side: newNet > 0 ? 'debit' : 'credit', amount: Math.abs(newNet) });
  return { ...input, lines };
}

/** Recover editable opening input from a saved opening entry. */
export function entryToOpeningInput(entry: JournalEntry): OpeningBalanceInput {
  return {
    date: entry.date,
    lines: entry.lines.map((l) => ({
      accountId: l.accountId,
      side: l.debit > 0 ? ('debit' as const) : ('credit' as const),
      amount: l.debit || l.credit,
    })),
  };
}

export function defaultSideFor(account: Account): Side {
  return normalSide(account);
}
