/**
 * Backup and restore of the books as a JSON file.
 *
 * Everything lives in the browser, so a backup file is the only copy that survives clearing site
 * data, a new browser or a new computer. API keys are deliberately NOT included: a backup file
 * may get emailed or shared, and keys are secrets.
 */
import { ACCOUNT_TYPES, withMissingDefaults } from './accounts';
import { validateEntry } from './journal';
import type { Account, Books, JournalEntry } from './types';

export const BACKUP_APP = 'better-accounting';
export const BACKUP_VERSION = 1;

/** The non-secret preferences saved with a backup. */
export interface BackupSettings {
  companyName: string;
  entryDate: string;
  periodFrom: string;
  theme: 'system' | 'light' | 'dark';
  style: 'gradient' | 'ledger';
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  books: Books;
  settings: BackupSettings;
}

export function makeBackup(books: Books, settings: BackupSettings, now: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    books: { accounts: books.accounts, entries: books.entries, nextSeq: books.nextSeq },
    settings: {
      companyName: settings.companyName,
      entryDate: settings.entryDate,
      periodFrom: settings.periodFrom,
      theme: settings.theme,
      style: settings.style,
    },
  };
}

export function backupFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `better-accounting-backup-${y}-${m}-${d}.json`;
}

export type RestoreResult =
  | { ok: true; books: Books; settings: BackupSettings; exportedAt: string; entryCount: number; accountCount: number }
  | { ok: false; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Check a backup file before it can replace anything: right app, readable, every account and
 * entry well-formed, and every entry balanced. Missing default accounts are added back so the
 * recognizer keeps working with older backups.
 */
export function parseBackup(text: string): RestoreResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That file isn't a Better Accounting backup (it couldn't be read as JSON)." };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, reason: "That file isn't a Better Accounting backup." };
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION)
    return { ok: false, reason: 'That backup was made by a newer version of the app. Update the app and try again.' };
  if (!isObj(raw.books) || !Array.isArray(raw.books.accounts) || !Array.isArray(raw.books.entries))
    return { ok: false, reason: 'The backup is missing its accounts or journal.' };

  const accounts: Account[] = [];
  const accountIds = new Set<string>();
  for (const a of raw.books.accounts as unknown[]) {
    if (
      !isObj(a) ||
      typeof a.id !== 'string' ||
      !a.id ||
      !Number.isInteger(a.number) ||
      typeof a.name !== 'string' ||
      !a.name.trim() ||
      !ACCOUNT_TYPES.includes(a.type as Account['type'])
    )
      return { ok: false, reason: 'The backup has an account that is missing information.' };
    if (accountIds.has(a.id)) return { ok: false, reason: 'The backup lists the same account twice.' };
    accountIds.add(a.id);
    accounts.push({
      id: a.id,
      number: a.number as number,
      name: a.name,
      type: a.type as Account['type'],
      ...(a.contra ? { contra: true } : {}),
      ...(typeof a.systemKey === 'string' ? { systemKey: a.systemKey } : {}),
    });
  }
  if (!accounts.length) return { ok: false, reason: 'The backup has no accounts.' };

  const entries: JournalEntry[] = [];
  const entryIds = new Set<string>();
  let openings = 0;
  let maxSeq = 0;
  for (const e of raw.books.entries as unknown[]) {
    if (
      !isObj(e) ||
      typeof e.id !== 'string' ||
      !Number.isInteger(e.seq) ||
      !isDate(e.date) ||
      typeof e.description !== 'string' ||
      (e.kind !== 'standard' && e.kind !== 'opening') ||
      !Array.isArray(e.lines)
    )
      return { ok: false, reason: 'The backup has a journal entry that is missing information.' };
    if (entryIds.has(e.id)) return { ok: false, reason: 'The backup lists the same journal entry twice.' };
    entryIds.add(e.id);
    const lines = (e.lines as unknown[]).map((l) =>
      isObj(l) ? { accountId: String(l.accountId), debit: Number(l.debit), credit: Number(l.credit) } : { accountId: '', debit: NaN, credit: NaN },
    );
    const v = validateEntry({ date: e.date, description: e.description || 'Entry', lines }, accounts);
    if (!v.ok) return { ok: false, reason: `Journal entry “${e.description}” (${e.date}) isn't valid: ${v.errors.join(' ')}` };
    if (e.kind === 'opening') openings++;
    else maxSeq = Math.max(maxSeq, e.seq as number);
    entries.push({
      id: e.id,
      seq: e.seq as number,
      date: e.date,
      description: e.description,
      lines,
      kind: e.kind,
      ...(typeof e.sourceText === 'string' ? { sourceText: e.sourceText } : {}),
      createdAt: typeof e.createdAt === 'number' ? e.createdAt : 0,
    });
  }
  if (openings > 1) return { ok: false, reason: 'The backup has more than one opening balance entry.' };

  const nextSeq = Number.isInteger(raw.books.nextSeq) && (raw.books.nextSeq as number) > maxSeq ? (raw.books.nextSeq as number) : maxSeq + 1;

  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: BackupSettings = {
    companyName: typeof s.companyName === 'string' ? s.companyName.trim() : '',
    entryDate: isDate(s.entryDate) ? s.entryDate : '',
    periodFrom: isDate(s.periodFrom) ? s.periodFrom : '',
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    style: s.style === 'ledger' ? 'ledger' : 'gradient',
  };

  const finalAccounts = withMissingDefaults(accounts);
  return {
    ok: true,
    books: { accounts: finalAccounts, entries, nextSeq },
    settings,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    entryCount: entries.filter((e) => e.kind !== 'opening').length,
    accountCount: accounts.length,
  };
}
