import { findBySystemKey } from '../accounts';
import { addEntry } from '../books';
import { parseWithRules } from '../parser/ruleParser';
import type { Account, Books } from '../types';

export function idOf(accounts: Account[], key: string): string {
  const a = findBySystemKey(accounts, key);
  if (!a) throw new Error('missing account ' + key);
  return a.id;
}

/** Parse a sentence and post it, failing the test if either step fails. */
export function post(books: Books, text: string, date = '2026-01-15'): Books {
  const parsed = parseWithRules(text, { accounts: books.accounts, today: date });
  if (parsed.status !== 'matched') throw new Error(`not parsed: "${text}" — ${parsed.reason}`);
  const r = addEntry(books, { date: parsed.date, description: parsed.description, lines: parsed.lines });
  if (!r.ok) throw new Error(r.errors.join(' '));
  return r.books;
}
