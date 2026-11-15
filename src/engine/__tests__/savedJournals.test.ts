import { addAccount, deleteAccount } from '../books';
import { findBySystemKey, SYSTEM_KEYS as K } from '../accounts';
import { makeSavedJournal, restoreSavedJournal } from '../savedJournals';
import { trialBalance } from '../reports';
import { buildSampleBooks } from '../sample';
import { clearJournal } from '../books';

describe('saved journals', () => {
  const books = buildSampleBooks(0);

  it('snapshots the journal and names it', () => {
    const s = makeSavedJournal(books, '  Month end  ', new Date('2026-11-14T15:42:00'));
    expect(s.name).toBe('Month end');
    expect(s.entryCount).toBe(13);
    expect(makeSavedJournal(books, '', new Date('2026-11-14T15:42:00')).name).toMatch(/^Journal · Nov 14, 2026/);
  });

  it('is a deep copy: later changes to the live books do not alter it', () => {
    const live = JSON.parse(JSON.stringify(books));
    const s = makeSavedJournal(live, 'x');
    live.entries[1].description = 'changed';
    live.accounts[0].name = 'Renamed';
    expect(s.entries[1].description).not.toBe('changed');
    expect(s.accounts[0].name).not.toBe('Renamed');
  });

  it('restores a cleared journal exactly, and the books still balance', () => {
    const s = makeSavedJournal(books, 'before');
    const cleared = clearJournal(books);
    if (!cleared.ok) throw new Error();
    const back = restoreSavedJournal(cleared.books, s);
    expect(back.entries).toEqual(books.entries);
    expect(back.nextSeq).toBeGreaterThanOrEqual(books.nextSeq);
    expect(trialBalance(back.accounts, back.entries).balanced).toBe(true);
  });

  it('re-adds an account that was deleted after the snapshot was taken', () => {
    const withLand = addAccount(books, { name: 'Land', type: 'asset', number: 1800 });
    if (!withLand.ok) throw new Error();
    const land = withLand.books.accounts.find((a) => a.name === 'Land')!;
    const entry = {
      id: 'e-land', seq: 99, date: '2026-02-01', description: 'Bought land', kind: 'standard' as const, createdAt: 0,
      lines: [{ accountId: land.id, debit: 100_000, credit: 0 }, { accountId: findBySystemKey(books.accounts, K.cash)!.id, debit: 0, credit: 100_000 }],
    };
    const snap = makeSavedJournal({ ...withLand.books, entries: [...withLand.books.entries, entry], nextSeq: 100 }, 'with land');
    // Later: journal cleared and the now-unused account deleted.
    const cleared = clearJournal({ ...withLand.books, entries: withLand.books.entries });
    if (!cleared.ok) throw new Error();
    const gone = deleteAccount(cleared.books, land.id);
    if (!gone.ok) throw new Error();
    expect(gone.books.accounts.some((a) => a.id === land.id)).toBe(false);
    const back = restoreSavedJournal(gone.books, snap);
    expect(back.accounts.some((a) => a.id === land.id && a.name === 'Land')).toBe(true);
    expect(trialBalance(back.accounts, back.entries).balanced).toBe(true);
    expect(back.nextSeq).toBe(100);
  });

  it('maps a missing account onto a same-named one instead of duplicating it', () => {
    const snap = makeSavedJournal(books, 'x');
    const cashId = findBySystemKey(books.accounts, K.cash)!.id;
    // Current books have a differently-ID'd "Cash" account.
    const current = { ...books, entries: [], accounts: books.accounts.map((a) => (a.id === cashId ? { ...a, id: 'cash-2' } : a)) };
    const back = restoreSavedJournal(current, snap);
    expect(back.accounts.filter((a) => a.name === 'Cash')).toHaveLength(1);
    expect(back.entries.flatMap((e) => e.lines).some((l) => l.accountId === cashId)).toBe(false);
    expect(trialBalance(back.accounts, back.entries).balanced).toBe(true);
  });
});
