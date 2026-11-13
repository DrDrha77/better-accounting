import { backupFilename, makeBackup, parseBackup, type BackupSettings } from '../backup';
import { buildSampleBooks } from '../sample';
import { balanceSheet, trialBalance } from '../reports';

const settings: BackupSettings = { companyName: 'Ridgeview Motel', entryDate: '2026-10-01', periodFrom: '2026-11-30', theme: 'dark', style: 'ledger' };
const books = buildSampleBooks(0);
const text = () => JSON.stringify(makeBackup(books, settings, new Date('2026-11-13T12:00:00Z')));

describe('backup and restore', () => {
  it('round-trips the books and preferences exactly', () => {
    const r = parseBackup(text());
    if (!r.ok) throw new Error(r.reason);
    expect(r.books.entries).toEqual(books.entries);
    expect(r.books.nextSeq).toBe(books.nextSeq);
    expect(r.books.accounts).toEqual(books.accounts);
    expect(r.settings).toEqual(settings);
    expect(r.entryCount).toBe(13);
    expect(trialBalance(r.books.accounts, r.books.entries).balanced).toBe(true);
    expect(balanceSheet(r.books.accounts, r.books.entries).balanced).toBe(true);
  });

  it('never includes API keys', () => {
    const t = text();
    expect(t).not.toMatch(/apiKey|api_key|sk-ant|AIza/i);
    expect(Object.keys(JSON.parse(t).settings).sort()).toEqual(['companyName', 'entryDate', 'periodFrom', 'style', 'theme']);
  });

  it('names the file with the date', () => {
    expect(backupFilename(new Date(2026, 10, 3))).toBe('better-accounting-backup-2026-11-03.json');
  });

  it.each([
    ['not JSON', 'hello'],
    ['another app', JSON.stringify({ app: 'something-else', version: 1 })],
    ['a newer version', JSON.stringify({ ...JSON.parse(text()), version: 99 })],
    ['no books', JSON.stringify({ app: 'better-accounting', version: 1 })],
  ])('rejects %s', (_n, bad) => {
    expect(parseBackup(bad).ok).toBe(false);
  });

  it('rejects an unbalanced entry instead of loading broken books', () => {
    const f = JSON.parse(text());
    f.books.entries[1].lines[0].debit += 100;
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok === false && r.reason).toMatch(/Debits must equal credits/);
  });

  it('rejects an entry pointing at a missing account', () => {
    const f = JSON.parse(text());
    f.books.entries[1].lines[0].accountId = 'nope';
    expect(parseBackup(JSON.stringify(f)).ok).toBe(false);
  });

  it('adds back default accounts missing from an older backup and fixes a stale nextSeq', () => {
    const f = JSON.parse(text());
    f.books.accounts = f.books.accounts.filter((a: { systemKey?: string }) => a.systemKey !== 'vehicles');
    f.books.nextSeq = 1;
    const r = parseBackup(JSON.stringify(f));
    if (!r.ok) throw new Error(r.reason);
    expect(r.books.accounts.some((a) => a.systemKey === 'vehicles')).toBe(true);
    expect(r.books.nextSeq).toBe(14);
  });

  it('sanitises odd preferences', () => {
    const f = JSON.parse(text());
    f.settings = { companyName: 5, theme: 'neon', style: 'glass', entryDate: 'soon', periodFrom: '2026-02-30x' };
    const r = parseBackup(JSON.stringify(f));
    if (!r.ok) throw new Error(r.reason);
    expect(r.settings).toEqual({ companyName: '', entryDate: '', periodFrom: '', theme: 'system', style: 'gradient' });
  });
});
