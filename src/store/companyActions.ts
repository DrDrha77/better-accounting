/**
 * Multiple companies: create, rename, switch and delete, plus the Undo machinery used by every
 * destructive action. Each company keeps its own books, preferences and saved journals under its own
 * storage keys; API keys and appearance stay shared (useSettings).
 */
import { emptyBooks } from '../engine/books';
import { newId } from '../engine/journal';
import type { SavedJournal } from '../engine/savedJournals';
import type { Books } from '../engine/types';
import { booksKey, companyDataKey, journalsKey } from './companyStorage';
import { safeLocalStorage } from './safeStorage';
import { useBooks } from './useBooks';
import { COMPANY_DEFAULTS, useCompany } from './useCompany';
import { DEFAULT_COMPANY_NAME, MAIN_COMPANY_ID, useCompanies } from './useCompanies';
import { useSavedJournals } from './useSavedJournals';
import { useUndo } from './useUndo';

/** Re-read every per-company store from the (now different) active company's keys. */
function rehydrateAll() {
  void useBooks.persist.rehydrate();
  void useCompany.persist.rehydrate();
  void useSavedJournals.persist.rehydrate();
}

/** Error text if the name can't be used, or null. */
export function validateCompanyName(name: string, exceptId?: string): string | null {
  const n = name.trim();
  if (!n) return 'Enter a company name.';
  if (n.length > 60) return 'Keep the name under 60 characters.';
  if (useCompanies.getState().companies.some((c) => c.id !== exceptId && c.name.toLowerCase() === n.toLowerCase()))
    return `You already have a company named “${n}”.`;
  return null;
}

function nextDefaultName(): string {
  const names = new Set(useCompanies.getState().companies.map((c) => c.name.toLowerCase()));
  for (let i = 2; ; i++) if (!names.has(`company ${i}`)) return `Company ${i}`;
}

/** Make sure the registry is sane and the active company has its data saved under its keys. Call once at startup. */
export function bootstrapCompanies() {
  const reg = useCompanies.getState();
  if (!reg.companies.length) reg.addCompany({ id: MAIN_COMPANY_ID, name: DEFAULT_COMPANY_NAME });
  const { companies, activeId } = useCompanies.getState();
  if (!companies.some((c) => c.id === activeId)) {
    useCompanies.getState().setActive(companies[0].id);
    rehydrateAll();
  }
  // Writing the current state guarantees every company has all of its keys, which switching relies on.
  useCompanies.setState({});
  useBooks.setState({});
  useCompany.setState({});
  useSavedJournals.setState({});
}

export function switchCompany(id: string): boolean {
  const reg = useCompanies.getState();
  if (id === reg.activeId || !reg.companies.some((c) => c.id === id)) return false;
  useUndo.getState().dismiss();
  reg.setActive(id);
  rehydrateAll();
  return true;
}

export type CompanyResult = { ok: true; id: string } | { ok: false; reason: string };

/** Create a company with its own empty books and switch to it. A blank name gets "Company 2", "Company 3"… */
export function createCompany(name: string): CompanyResult {
  const trimmed = name.trim() || nextDefaultName();
  const problem = validateCompanyName(trimmed);
  if (problem) return { ok: false, reason: problem };
  const id = newId();
  useUndo.getState().dismiss();
  useCompanies.getState().addCompany({ id, name: trimmed });
  useCompanies.getState().setActive(id);
  // These writes land under the new company's keys, because it is now the active one.
  useBooks.setState(emptyBooks());
  useCompany.setState({ ...COMPANY_DEFAULTS });
  useSavedJournals.setState({ items: [] });
  return { ok: true, id };
}

/** Rename a company. Returns an error message, or null on success. */
export function renameCompany(id: string, name: string): string | null {
  const problem = validateCompanyName(name, id);
  if (problem) return problem;
  useCompanies.getState().renameCompany(id, name.trim());
  return null;
}

/**
 * Delete a company and everything it holds. The last company can't be deleted. Shows an Undo bar that
 * puts the company back exactly as it was.
 */
export function deleteCompany(id: string): boolean {
  const reg = useCompanies.getState();
  if (reg.companies.length <= 1) return false;
  const index = reg.companies.findIndex((c) => c.id === id);
  if (index < 0) return false;
  const meta = reg.companies[index];
  const wasActive = reg.activeId === id;
  const keys = [booksKey(id), companyDataKey(id), journalsKey(id)];
  const saved = keys.map((k) => safeLocalStorage.getItem(k));

  if (wasActive) switchCompany((reg.companies[index + 1] ?? reg.companies[index - 1]).id);
  keys.forEach((k) => safeLocalStorage.removeItem(k));
  useCompanies.getState().removeCompany(id);

  useUndo.getState().push(`Deleted company “${meta.name}”`, () => {
    keys.forEach((k, i) => saved[i] !== null && safeLocalStorage.setItem(k, saved[i] as string));
    useCompanies.getState().insertCompany(meta, index);
    if (wasActive) switchCompany(id);
  });
  return true;
}

// ---------------------------------------------------------------- Undo

export interface CompanySnapshot {
  id: string;
  name: string;
  books: Books;
  company: typeof COMPANY_DEFAULTS;
  journals: SavedJournal[];
}

export function captureActive(): CompanySnapshot {
  const { companies, activeId } = useCompanies.getState();
  const b = useBooks.getState();
  const c = useCompany.getState();
  return {
    id: activeId,
    name: companies.find((x) => x.id === activeId)?.name ?? '',
    books: { accounts: b.accounts, entries: b.entries, nextSeq: b.nextSeq },
    company: { entryDate: c.entryDate, periodFrom: c.periodFrom, lastBackupAt: c.lastBackupAt },
    journals: useSavedJournals.getState().items,
  };
}

/** Put a captured company state back (only if that company is still the active one). */
export function restoreSnapshot(s: CompanySnapshot) {
  if (useCompanies.getState().activeId !== s.id) return;
  useBooks.getState().restore(s.books);
  useCompany.setState({ ...s.company });
  useSavedJournals.setState({ items: s.journals });
  if (s.name) useCompanies.getState().renameCompany(s.id, s.name);
}

/**
 * Run an action immediately (no confirm dialog) and show an Undo bar for a few seconds that puts the
 * active company back the way it was. Return `false` from the action if it did nothing.
 */
export function undoable(message: string, action: () => boolean | void) {
  const before = captureActive();
  // An action that reports `false` did nothing (for example it was refused), so there is nothing to undo.
  if (action() === false) return;
  useUndo.getState().push(message, () => restoreSnapshot(before));
}
