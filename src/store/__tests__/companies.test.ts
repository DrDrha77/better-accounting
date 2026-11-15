import { buildSampleBooks } from '../../engine/sample';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  keys() { return [...this.m.keys()]; }
}

let mem: MemStorage;

/** Load the app's stores fresh, as if the page had just been opened, on top of whatever is in `mem`. */
async function openApp() {
  vi.resetModules();
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = mem;
  const actions = await import('../companyActions');
  const { useBooks } = await import('../useBooks');
  const { useCompany } = await import('../useCompany');
  const { useCompanies } = await import('../useCompanies');
  const { useSavedJournals } = await import('../useSavedJournals');
  const { useUndo } = await import('../useUndo');
  actions.bootstrapCompanies();
  return { actions, useBooks, useCompany, useCompanies, useSavedJournals, useUndo };
}

const entry = (description: string, amount = 100_000) => ({
  date: '2026-12-01',
  description,
  lines: [
    { accountId: 'cash', debit: amount, credit: 0 },
    { accountId: 'capital', debit: 0, credit: amount },
  ],
});

beforeEach(() => {
  mem = new MemStorage();
});

describe('companies: upgrading from a single-company version', () => {
  it('keeps existing books, name and preferences as the first company', async () => {
    const books = buildSampleBooks(0);
    mem.setItem('better-accounting:books', JSON.stringify({ state: books, version: 2 }));
    mem.setItem(
      'better-accounting:settings',
      JSON.stringify({ state: { companyName: 'Ridgeview Motel', entryDate: '2026-10-01', periodFrom: '2026-11-30', lastBackupAt: '', theme: 'dark', design: 'apple', style: 'gradient', aiProvider: 'gemini', aiMode: 'fallback', apiKeys: { gemini: 'k', anthropic: '' } }, version: 6 }),
    );
    const { useBooks, useCompany, useCompanies } = await openApp();
    expect(useCompanies.getState().companies).toEqual([{ id: 'main', name: 'Ridgeview Motel' }]);
    expect(useBooks.getState().entries).toHaveLength(14);
    expect(useCompany.getState()).toMatchObject({ entryDate: '2026-10-01', periodFrom: '2026-11-30' });
    // Its data now has its own keys too.
    expect(mem.getItem('better-accounting:company:main')).toContain('2026-11-30');
    expect(mem.getItem('better-accounting:companies')).toContain('Ridgeview Motel');
    expect(mem.getItem('better-accounting:journals:main')).not.toBeNull();
  });

  it('starts a brand-new user with one company called "My company"', async () => {
    const { useCompanies, useBooks } = await openApp();
    expect(useCompanies.getState().companies.map((c) => c.name)).toEqual(['My company']);
    expect(useBooks.getState().entries).toHaveLength(0);
  });
});

describe('companies: create and switch', () => {
  it('gives every company its own books, preferences and saved journals', async () => {
    const app = await openApp();
    app.useBooks.getState().addEntry(entry('Main entry'));
    app.useCompany.getState().setPeriodFrom('2026-01-01');
    app.useSavedJournals.getState().save(app.useBooks.getState(), 'Main snapshot');

    const created = app.actions.createCompany('Acme');
    expect(created.ok).toBe(true);
    expect(app.useCompanies.getState().companies.map((c) => c.name)).toEqual(['My company', 'Acme']);
    expect(app.useBooks.getState().entries).toHaveLength(0);
    expect(app.useCompany.getState().periodFrom).toBe('');
    expect(app.useSavedJournals.getState().items).toHaveLength(0);

    app.useBooks.getState().addEntry(entry('Acme entry', 555_00));
    app.useBooks.getState().addEntry(entry('Acme second', 10_00));

    app.actions.switchCompany('main');
    expect(app.useBooks.getState().entries.map((e) => e.description)).toEqual(['Main entry']);
    expect(app.useCompany.getState().periodFrom).toBe('2026-01-01');
    expect(app.useSavedJournals.getState().items.map((j) => j.name)).toEqual(['Main snapshot']);

    app.actions.switchCompany(created.ok ? created.id : '');
    expect(app.useBooks.getState().entries.map((e) => e.description)).toEqual(['Acme entry', 'Acme second']);
    expect(app.useCompany.getState().periodFrom).toBe('');
  });

  it('remembers the companies and the active one after the app is closed and reopened', async () => {
    const app = await openApp();
    app.useBooks.getState().addEntry(entry('Main entry'));
    const created = app.actions.createCompany('Acme');
    app.useBooks.getState().addEntry(entry('Acme entry'));

    const again = await openApp();
    expect(again.useCompanies.getState().activeId).toBe(created.ok ? created.id : '');
    expect(again.useBooks.getState().entries.map((e) => e.description)).toEqual(['Acme entry']);
    again.actions.switchCompany('main');
    expect(again.useBooks.getState().entries.map((e) => e.description)).toEqual(['Main entry']);
  });

  it('names new companies "Company 2", "Company 3" when no name is given', async () => {
    const app = await openApp();
    app.actions.createCompany('');
    app.actions.createCompany('   ');
    expect(app.useCompanies.getState().companies.map((c) => c.name)).toEqual(['My company', 'Company 2', 'Company 3']);
  });

  it('rejects duplicate and blank names, but allows renaming to a different case of itself', async () => {
    const app = await openApp();
    expect(app.actions.createCompany('my COMPANY')).toMatchObject({ ok: false });
    const c = app.actions.createCompany('Acme');
    expect(app.actions.renameCompany('main', 'ACME')).toMatch(/already have/);
    expect(app.actions.renameCompany('main', '  ')).toMatch(/Enter a company name/);
    expect(app.actions.renameCompany('main', 'Ridgeview Motel')).toBeNull();
    expect(app.actions.renameCompany(c.ok ? c.id : '', 'acme')).toBeNull();
    expect(app.useCompanies.getState().companies.map((x) => x.name)).toEqual(['Ridgeview Motel', 'acme']);
  });
});

describe('companies: delete and undo', () => {
  it('cannot delete the only company', async () => {
    const app = await openApp();
    expect(app.actions.deleteCompany('main')).toBe(false);
    expect(app.useCompanies.getState().companies).toHaveLength(1);
  });

  it('deleting the active company switches to another and Undo brings it back whole', async () => {
    const app = await openApp();
    app.useBooks.getState().addEntry(entry('Main entry'));
    const c = app.actions.createCompany('Acme');
    const acmeId = c.ok ? c.id : '';
    app.useBooks.getState().addEntry(entry('Acme entry'));
    app.useSavedJournals.getState().save(app.useBooks.getState(), 'Acme snapshot');

    expect(app.actions.deleteCompany(acmeId)).toBe(true);
    expect(app.useCompanies.getState().companies.map((x) => x.name)).toEqual(['My company']);
    expect(app.useCompanies.getState().activeId).toBe('main');
    expect(app.useBooks.getState().entries.map((e) => e.description)).toEqual(['Main entry']);
    expect(mem.keys().some((k) => k.includes(acmeId))).toBe(false);
    expect(app.useUndo.getState().item?.message).toBe('Deleted company “Acme”');

    app.useUndo.getState().run();
    expect(app.useCompanies.getState().companies.map((x) => x.name)).toEqual(['My company', 'Acme']);
    expect(app.useCompanies.getState().activeId).toBe(acmeId);
    expect(app.useBooks.getState().entries.map((e) => e.description)).toEqual(['Acme entry']);
    expect(app.useSavedJournals.getState().items.map((j) => j.name)).toEqual(['Acme snapshot']);
    expect(app.useUndo.getState().item).toBeNull();
  });

  it('deleting a company that is not active leaves the active one alone', async () => {
    const app = await openApp();
    const c = app.actions.createCompany('Acme');
    app.actions.switchCompany('main');
    app.useBooks.getState().addEntry(entry('Main entry'));
    app.actions.deleteCompany(c.ok ? c.id : '');
    expect(app.useCompanies.getState().activeId).toBe('main');
    expect(app.useBooks.getState().entries).toHaveLength(1);
  });
});

describe('undoable actions', () => {
  it('shows no Undo bar when the action reports it did nothing', async () => {
    const app = await openApp();
    app.actions.undoable('Nothing happened', () => false);
    expect(app.useUndo.getState().item).toBeNull();
  });

  it('runs at once and Undo puts the books back', async () => {
    const app = await openApp();
    app.useBooks.getState().addEntry(entry('Keep me'));
    app.actions.undoable('Cleared the journal', () => {
      app.useBooks.getState().clearJournal();
    });
    expect(app.useBooks.getState().entries).toHaveLength(0);
    expect(app.useUndo.getState().item?.message).toBe('Cleared the journal');
    app.useUndo.getState().run();
    expect(app.useBooks.getState().entries.map((e) => e.description)).toEqual(['Keep me']);
  });

  it('is dropped when you switch company, so it can never undo into the wrong books', async () => {
    const app = await openApp();
    app.actions.undoable('Did something', () => {
      app.useBooks.getState().addEntry(entry('x'));
    });
    app.actions.createCompany('Acme');
    expect(app.useUndo.getState().item).toBeNull();
  });
});
