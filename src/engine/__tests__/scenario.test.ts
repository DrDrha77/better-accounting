import { findBySystemKey, SYSTEM_KEYS as K } from '../accounts';
import { addEntry, deleteAccount, deleteEntry, emptyBooks, updateEntry } from '../books';
import { validateEntry } from '../journal';
import { ledgerFor, tAccount } from '../ledger';
import { balanceSheet, incomeStatement, ownersEquityStatement, trialBalance } from '../reports';
import { buildSampleBooks } from '../sample';
import type { Books } from '../types';
import { post } from './helpers';

function runScenario(): Books {
  let b = emptyBooks();
  b = post(b, 'Owner invested 40000 into the business', '2026-01-01');
  b = post(b, 'Bought equipment for 5000 cash', '2026-01-02');
  b = post(b, 'Bought supplies on credit for 800', '2026-01-03');
  b = post(b, 'Earned 3000 service revenue in cash', '2026-01-05');
  b = post(b, 'Earned 1500 service revenue on account', '2026-01-06');
  b = post(b, 'Paid rent 1200', '2026-01-07');
  b = post(b, 'Paid wages 2000', '2026-01-08');
  b = post(b, 'Owner withdrew 500', '2026-01-09');
  b = post(b, 'Collected 1000 from customer', '2026-01-10');
  b = post(b, 'Paid 400 on account', '2026-01-11');
  b = post(b, 'Borrowed 10000 from the bank', '2026-01-12');
  return b;
}

const bal = (b: Books, key: string) => ledgerFor(findBySystemKey(b.accounts, key)!, b.entries).balance;

describe('full scenario', () => {
  const b = runScenario();

  it('posts every transaction to the right accounts', () => {
    expect(b.entries).toHaveLength(11);
    expect(bal(b, K.cash)).toBe(4_490_000); // 40000-5000+3000-1200-2000-500+1000-400+10000
    expect(bal(b, K.accountsReceivable)).toBe(50_000);
    expect(bal(b, K.accountsPayable)).toBe(40_000);
    expect(bal(b, K.ownersDrawings)).toBe(50_000); // contra equity: debit-normal
  });

  it('ends with a balanced trial balance', () => {
    const tb = trialBalance(b.accounts, b.entries);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.totalDebit).toBe(5_490_000); // cash+AR+supplies+equipment+drawings+rent+wages
  });

  it('produces the income statement', () => {
    const is = incomeStatement(b.accounts, b.entries, '2026-01-01', '2026-01-31');
    expect(is.totalRevenue).toBe(450_000);
    expect(is.totalExpenses).toBe(320_000);
    expect(is.netIncome).toBe(130_000);
  });

  it('ends with a balanced balance sheet (A = L + E)', () => {
    const bs = balanceSheet(b.accounts, b.entries, '2026-01-31');
    expect(bs.totalAssets).toBe(5_120_000);
    expect(bs.totalLiabilities).toBe(1_040_000);
    expect(bs.netIncome).toBe(130_000);
    expect(bs.totalEquity).toBe(4_080_000); // 40000 - 500 + 1300
    expect(bs.balanced).toBe(true);
  });

  it('respects as-of dates', () => {
    const tb = trialBalance(b.accounts, b.entries, '2026-01-02');
    expect(tb.rows.map((r) => r.account.id)).toEqual([K.cash, K.equipment, K.ownersCapital]);
    expect(balanceSheet(b.accounts, b.entries, '2026-01-05').balanced).toBe(true);
  });

  it('owner’s equity statement ties to the balance sheet', () => {
    const oe = ownersEquityStatement(b.accounts, b.entries, '2026-01-01', '2026-01-31');
    expect(oe).toMatchObject({ beginningEquity: 0, investments: 4_000_000, netIncome: 130_000, drawings: 50_000 });
    expect(oe.endingEquity).toBe(balanceSheet(b.accounts, b.entries, '2026-01-31').totalEquity);
    const later = ownersEquityStatement(b.accounts, b.entries, '2026-01-06', '2026-01-31');
    expect(later.endingEquity).toBe(oe.endingEquity);
  });

  it('T-account shows debits left, credits right, and the ending balance', () => {
    const t = tAccount(findBySystemKey(b.accounts, K.cash)!, b.entries);
    expect(t.debits).toHaveLength(4);
    expect(t.credits).toHaveLength(5);
    expect(t.balance).toBe(4_490_000);
    expect(t.balanceSide).toBe('debit');
  });

  it('ledger running balance follows normal-balance rules', () => {
    const cap = ledgerFor(findBySystemKey(b.accounts, K.ownersCapital)!, b.entries);
    expect(cap.rows[0].balance).toBe(4_000_000);
    const cash = ledgerFor(findBySystemKey(b.accounts, K.cash)!, b.entries);
    expect(cash.rows.map((r) => r.balance).slice(0, 3)).toEqual([4_000_000, 3_500_000, 3_800_000]);
  });
});

describe('editing and deleting recalculates everything', () => {
  it('edit changes downstream balances; delete removes them; reports stay balanced', () => {
    let b = runScenario();
    const rent = b.entries.find((e) => e.description === 'Paid rent 1200')!;
    const edited = updateEntry(b, rent.id, {
      date: rent.date,
      description: 'Paid rent 1500',
      lines: [
        { accountId: K.rentExpense, debit: 150_000, credit: 0 },
        { accountId: K.cash, debit: 0, credit: 150_000 },
      ],
    });
    if (!edited.ok) throw new Error(edited.errors.join());
    b = edited.books;
    expect(bal(b, K.cash)).toBe(4_460_000);
    expect(incomeStatement(b.accounts, b.entries).netIncome).toBe(100_000);
    expect(balanceSheet(b.accounts, b.entries).balanced).toBe(true);

    const del = deleteEntry(b, rent.id);
    if (!del.ok) throw new Error();
    b = del.books;
    expect(bal(b, K.cash)).toBe(4_610_000);
    expect(bal(b, K.rentExpense)).toBe(0);
    expect(trialBalance(b.accounts, b.entries).balanced).toBe(true);
    expect(b.entries).toHaveLength(10);
  });

  it('rejects unbalanced or malformed entries', () => {
    const b = emptyBooks();
    const r = addEntry(b, {
      date: '2026-01-01',
      description: 'oops',
      lines: [
        { accountId: K.cash, debit: 100, credit: 0 },
        { accountId: K.ownersCapital, debit: 0, credit: 99 },
      ],
    });
    expect(r.ok).toBe(false);
    expect(validateEntry({ date: '2026-02-30', description: 'x', lines: [] }, b.accounts).errors).toContain('Enter a valid date.');
    expect(
      validateEntry(
        { date: '2026-01-01', description: 'x', lines: [{ accountId: K.cash, debit: 1.5, credit: 0 }, { accountId: K.ownersCapital, debit: 0, credit: 1.5 }] },
        b.accounts,
      ).ok,
    ).toBe(false);
  });

  it('blocks deleting an account that has transactions', () => {
    const b = runScenario();
    expect(deleteAccount(b, K.cash).ok).toBe(false);
    expect(deleteAccount(b, K.miscExpense).ok).toBe(true);
  });
});

describe('sample data', () => {
  it('builds balanced books', () => {
    const b = buildSampleBooks(0);
    expect(trialBalance(b.accounts, b.entries).balanced).toBe(true);
    expect(balanceSheet(b.accounts, b.entries).balanced).toBe(true);
    expect(b.entries[0].kind).toBe('opening');
  });
});
