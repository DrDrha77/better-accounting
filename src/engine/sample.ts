import { findBySystemKey, SYSTEM_KEYS as K } from './accounts';
import { addEntry, emptyBooks, saveOpening } from './books';
import { parseWithRules } from './parser/ruleParser';
import { parseAmount } from './money';
import type { Books } from './types';

/** Plain-English sample transactions, run through the real parser. */
export const SAMPLE_TRANSACTIONS: { date: string; text: string }[] = [
  { date: '2026-01-02', text: 'Owner invested 40000 into the business' },
  { date: '2026-01-03', text: 'Bought equipment for 5000 cash' },
  { date: '2026-01-05', text: 'Bought supplies on credit for 800' },
  { date: '2026-01-06', text: 'Paid 1200 for a one year insurance policy' },
  { date: '2026-01-10', text: 'Earned 3000 service revenue in cash' },
  { date: '2026-01-12', text: 'Earned 1500 service revenue on account' },
  { date: '2026-01-15', text: 'Paid rent 1200' },
  { date: '2026-01-15', text: 'Borrowed 10000 from the bank' },
  { date: '2026-01-20', text: 'Collected 1000 from customer' },
  { date: '2026-01-22', text: 'Paid 400 on account' },
  { date: '2026-01-25', text: 'Paid utilities 250' },
  { date: '2026-01-31', text: 'Paid wages 2000' },
  { date: '2026-01-31', text: 'Owner withdrew 500' },
];

/** Opening position carried in from before the sample period. */
export const SAMPLE_OPENING = {
  date: '2026-01-01',
  balances: [
    [K.cash, 'debit', '15,000'],
    [K.accountsReceivable, 'debit', '2,000'],
    [K.equipment, 'debit', '8,000'],
    [K.accountsPayable, 'credit', '3,000'],
    [K.ownersCapital, 'credit', '22,000'],
  ] as const,
};

export function buildSampleBooks(now = Date.now()): Books {
  let books = emptyBooks();
  const opening = saveOpening(books, {
    date: SAMPLE_OPENING.date,
    lines: SAMPLE_OPENING.balances.map(([key, side, amt]) => ({
      accountId: findBySystemKey(books.accounts, key)!.id,
      side,
      amount: parseAmount(amt)!,
    })),
  }, now);
  if (!opening.ok) throw new Error('Sample opening balance invalid: ' + opening.errors.join(' '));
  books = opening.books;

  SAMPLE_TRANSACTIONS.forEach(({ date, text }, i) => {
    const parsed = parseWithRules(text, { accounts: books.accounts, today: date });
    if (parsed.status !== 'matched') throw new Error(`Sample sentence not parsed: "${text}" — ${parsed.reason}`);
    const r = addEntry(books, { date: parsed.date, description: parsed.description, lines: parsed.lines, sourceText: text }, now + i + 1);
    if (!r.ok) throw new Error(r.errors.join(' '));
    books = r.books;
  });
  return books;
}
