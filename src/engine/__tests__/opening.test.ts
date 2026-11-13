import { SYSTEM_KEYS as K } from '../accounts';
import { emptyBooks, removeOpening, saveOpening } from '../books';
import { sortEntries } from '../journal';
import { ledgerFor, tAccount } from '../ledger';
import { entryToOpeningInput, openingTotals, plugToOpeningBalanceEquity, type OpeningBalanceInput } from '../opening';
import { balanceSheet, openingStatement, ownersEquityStatement, trialBalance } from '../reports';
import { post } from './helpers';

const balanced: OpeningBalanceInput = {
  date: '2026-01-01',
  lines: [
    { accountId: K.cash, side: 'debit', amount: 1_500_000 },
    { accountId: K.equipment, side: 'debit', amount: 800_000 },
    { accountId: K.accountsPayable, side: 'credit', amount: 300_000 },
    { accountId: K.ownersCapital, side: 'credit', amount: 2_000_000 },
    { accountId: K.supplies, side: 'debit', amount: 0 },
  ],
};

describe('opening balance flow', () => {
  it('saves a balanced opening entry as the first, labelled entry', () => {
    let b = emptyBooks();
    b = post(b, 'Paid rent 500', '2026-01-01'); // same date: opening must still sort first
    const r = saveOpening(b, balanced);
    if (!r.ok) throw new Error(r.errors.join());
    const first = sortEntries(r.books.entries)[0];
    expect(first.kind).toBe('opening');
    expect(first.description).toBe('Opening Balance');
    expect(first.seq).toBe(0);
    expect(first.lines).toHaveLength(4); // zero line dropped
  });

  it('rejects an unbalanced opening balance and shows the difference', () => {
    const unbalanced: OpeningBalanceInput = { ...balanced, lines: balanced.lines.slice(0, 3) };
    expect(openingTotals(unbalanced).difference).toBe(2_000_000);
    const r = saveOpening(emptyBooks(), unbalanced);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain('Debits must equal credits.');
  });

  it('can post the difference to Opening Balance Equity', () => {
    const b = emptyBooks();
    const unbalanced: OpeningBalanceInput = { ...balanced, lines: balanced.lines.slice(0, 3) };
    const plugged = plugToOpeningBalanceEquity(unbalanced, b.accounts);
    expect(openingTotals(plugged).difference).toBe(0);
    expect(plugged.lines.find((l) => l.accountId === K.openingBalanceEquity)).toEqual({
      accountId: K.openingBalanceEquity,
      side: 'credit',
      amount: 2_000_000,
    });
    // Credits exceeding debits plug to a debit.
    const creditHeavy = plugToOpeningBalanceEquity(
      { date: '2026-01-01', lines: [{ accountId: K.accountsPayable, side: 'credit', amount: 100 }] },
      b.accounts,
    );
    expect(creditHeavy.lines[1]).toEqual({ accountId: K.openingBalanceEquity, side: 'debit', amount: 100 });
    expect(saveOpening(b, plugged).ok).toBe(true);
  });

  it('carries through the ledger, T-accounts, trial balance and statements', () => {
    let b = emptyBooks();
    const r = saveOpening(b, balanced);
    if (!r.ok) throw new Error();
    b = post(r.books, 'Earned 2000 service revenue in cash', '2026-01-10');
    b = post(b, 'Paid 300 on account', '2026-01-11');

    const cashLedger = ledgerFor(b.accounts.find((a) => a.id === K.cash)!, b.entries);
    expect(cashLedger.rows[0]).toMatchObject({ entryLabel: 'OB', description: 'Opening Balance', balance: 1_500_000 });
    expect(cashLedger.balance).toBe(1_670_000);

    const tAP = tAccount(b.accounts.find((a) => a.id === K.accountsPayable)!, b.entries);
    expect(tAP.credits[0].entryLabel).toBe('OB');
    expect(tAP.balance).toBe(270_000);
    expect(tAP.balanceSide).toBe('credit');

    expect(trialBalance(b.accounts, b.entries).balanced).toBe(true);
    const bs = balanceSheet(b.accounts, b.entries);
    expect(bs.balanced).toBe(true);
    expect(bs.totalAssets).toBe(2_470_000);

    const os = openingStatement(b.accounts, b.entries)!;
    expect(os.asOf).toBe('2026-01-01');
    expect(os.totalAssets).toBe(2_300_000);
    expect(os.totalLiabilities).toBe(300_000);
    expect(os.totalEquity).toBe(2_000_000);
    expect(os.balanced).toBe(true);

    const oe = ownersEquityStatement(b.accounts, b.entries, '2026-01-01', '2026-01-31');
    expect(oe.beginningEquity).toBe(2_000_000);
    expect(oe.investments).toBe(0);
    expect(oe.netIncome).toBe(200_000);
    expect(oe.endingEquity).toBe(bs.totalEquity);
  });

  it('re-saving replaces the opening entry; it can be round-tripped and removed', () => {
    const first = saveOpening(emptyBooks(), balanced);
    if (!first.ok) throw new Error();
    const opening = first.books.entries[0];
    const input = entryToOpeningInput(opening);
    input.lines = input.lines.map((l) => (l.accountId === K.cash ? { ...l, amount: 1_600_000 } : l));
    const second = saveOpening(first.books, plugToOpeningBalanceEquity(input, first.books.accounts));
    if (!second.ok) throw new Error();
    expect(second.books.entries.filter((e) => e.kind === 'opening')).toHaveLength(1);
    expect(second.books.entries[0].id).toBe(opening.id);
    expect(openingStatement(second.books.accounts, second.books.entries)!.balanced).toBe(true);
    const removed = removeOpening(second.books);
    expect(removed.ok && openingStatement(removed.books.accounts, removed.books.entries)).toBeNull();
  });
});

describe('opening balance memo', () => {
  it('uses the memo as the journal description, defaulting to "Opening Balance"', () => {
    const withMemo = saveOpening(emptyBooks(), { ...balanced, description: 'Balances carried over from 2025' });
    expect(withMemo.ok && withMemo.books.entries[0].description).toBe('Balances carried over from 2025');
    const blank = saveOpening(emptyBooks(), { ...balanced, description: '   ' });
    expect(blank.ok && blank.books.entries[0].description).toBe('Opening Balance');
    if (!withMemo.ok) throw new Error();
    expect(entryToOpeningInput(withMemo.books.entries[0]).description).toBe('Balances carried over from 2025');
  });
});
