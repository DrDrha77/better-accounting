import { describe, expect, it } from 'vitest';
import { accountGroup, autoGroup } from '../classify';
import { balanceSheet, classify } from '../reports';
import { buildSampleBooks } from '../sample';
import { worksheet } from '../worksheet';

describe('worksheet', () => {
  it('balances each column pair with net income as the plug', () => {
    const books = buildSampleBooks();
    const ws = worksheet(books.accounts, books.entries);
    expect(ws.rows.length).toBeGreaterThan(0);
    expect(ws.balanced).toBe(true);
    expect(ws.total.isDebit).toBe(ws.total.isCredit);
    expect(ws.total.bsDebit).toBe(ws.total.bsCredit);
  });
});

describe('classified balance sheet', () => {
  it('splits current and fixed, and still adds up', () => {
    const books = buildSampleBooks();
    const bs = balanceSheet(books.accounts, books.entries);
    const c = classify(bs);
    expect(c.totalCurrentAssets + c.totalFixedAssets).toBe(bs.totalAssets);
    expect(c.totalCurrentLiabilities + c.totalLongTermLiabilities).toBe(bs.totalLiabilities);
    expect(c.fixedAssets.some((l) => l.account.name === 'Equipment')).toBe(true);
    expect(c.currentAssets.some((l) => l.account.name === 'Cash')).toBe(true);
  });

  it('guesses from the name, and the user choice wins', () => {
    expect(autoGroup({ type: 'asset', name: 'Training Equipment', number: 1230 })).toBe('noncurrent');
    expect(autoGroup({ type: 'liability', name: 'Bank Loan', number: 2400 })).toBe('noncurrent');
    expect(autoGroup({ type: 'liability', name: 'Accounts Payable', number: 2000 })).toBe('current');
    expect(accountGroup({ id: 'x', type: 'asset', name: 'Cash', number: 1000, group: 'noncurrent' })).toBe('noncurrent');
  });
});
