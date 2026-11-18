import { describe, expect, it } from 'vitest';
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
