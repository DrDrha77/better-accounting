import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { OpeningBalancesCard } from '../components/OpeningBalancesCard';
import { cx, downloadFile, fmtDate, formatCents } from '../components/format';
import { Button, Card, ErrorList, Field, inputClass, PageHeader } from '../components/ui';
import { lazyAiParser } from '../components/useTransactionParser';
import { ACCOUNT_TYPES, sortAccounts, suggestAccountNumber, SYSTEM_KEYS, TYPE_LABELS } from '../engine/accounts';
import { todayISO } from '../engine/journal';
import type { AiProvider } from '../engine/parser/aiShared';
import type { AiMode } from '../engine/parser/hybridParser';
import { PROVIDERS } from '../engine/parser/modelInfo';
import type { ParseResult } from '../engine/parser/types';
import { openingStatement } from '../engine/reports';
import type { Account, AccountType } from '../engine/types';
import { createCompany, deleteCompany, renameCompany, switchCompany, undoable } from '../store/companyActions';
import { useBooks } from '../store/useBooks';
import { useCompany } from '../store/useCompany';
import { useCompanies, useCompanyName } from '../store/useCompanies';
import { useSaveStatus } from '../store/safeStorage';
import { useSettings, type AccentPref, type DesignPref, type StylePref, type ThemePref } from '../store/useSettings';
import { ALL_TABS } from '../components/Layout';
import { backupFilename, makeBackup, parseBackup } from '../engine/backup';
import { BalanceSheetBody } from './BalanceSheet';

const MODES: { value: AiMode; label: string; help: string }[] = [
  { value: 'fallback', label: 'When the rules can’t tell (recommended)', help: 'Common sentences are recognised instantly for free; only the tricky ones are sent to the AI.' },
  { value: 'always', label: 'Always use AI', help: 'Every sentence goes to the AI. Smartest, but each one is an API call and takes a few seconds.' },
  { value: 'off', label: 'Off', help: 'Only the built-in rules are used. Nothing is sent anywhere.' },
];

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Match my device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const DESIGNS: { value: DesignPref; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'apple', label: 'Apple-style' },
];

const STYLES: { value: StylePref; label: string }[] = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'ledger', label: 'Lined paper' },
];

const TEST_SENTENCE = 'Bought a used delivery van for 18,500, paid 5,000 cash and financed the rest';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="field inline-flex flex-wrap gap-1 rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300',
            value === o.value ? 'seg-active pill-active text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="serif text-lg font-bold text-slate-900">{children}</h2>;
}

// ---------------------------------------------------------------- Companies

function CompaniesCard() {
  const companies = useCompanies((s) => s.companies);
  const activeId = useCompanies((s) => s.activeId);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const add = () => {
    const r = createCompany(name);
    if (!r.ok) return setError(r.reason);
    setName('');
    setError(null);
  };

  const saveRename = (id: string) => {
    const problem = renameCompany(id, editName);
    if (problem) return setError(problem);
    setEditing(null);
    setError(null);
  };

  return (
    <Card className="p-5 sm:p-6">
      <div id="companies" className="scroll-mt-24" />
      <SectionTitle>Companies</SectionTitle>
      <p className="mt-1 text-sm text-slate-600">
        Each company keeps its own books, opening balances, period and saved journals. Your API keys and appearance are shared by all of them. The company
        name appears at the top of its statements.
      </p>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          aria-label="New company name"
          className={cx(inputClass, 'py-2 text-base sm:flex-1')}
          placeholder="New company name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <Button type="submit" variant="primary">
          Add company
        </Button>
      </form>
      <div className="mt-2">
        <ErrorList errors={error ? [error] : []} />
      </div>

      <ul className="mt-3 divide-y divide-slate-400/20 rounded-2xl border border-slate-400/25">
        {companies.map((c) => {
          const active = c.id === activeId;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              {editing === c.id ? (
                <form
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveRename(c.id);
                  }}
                >
                  <input aria-label={`Rename ${c.name}`} className={cx(inputClass, 'min-w-[10rem] flex-1 py-1.5')} value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} />
                  <Button type="submit" variant="primary">
                    Save
                  </Button>
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-900">{c.name}</span>
                    {active && <span className="ml-2 rounded-full bg-cyan-700/10 px-2 py-0.5 text-xs font-medium text-cyan-700">Active</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!active && <Button onClick={() => switchCompany(c.id)}>Switch to</Button>}
                    <Button
                      onClick={() => {
                        setEditing(c.id);
                        setEditName(c.name);
                        setError(null);
                      }}
                    >
                      Rename
                    </Button>
                    <Button variant="danger" disabled={companies.length < 2} title={companies.length < 2 ? 'You need at least one company' : `Delete ${c.name}`} onClick={() => deleteCompany(c.id)}>
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------- Chart of accounts

function ChartOfAccountsCard() {
  const { accounts, entries, addAccount, deleteAccount } = useBooks();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('expense');
  const [errors, setErrors] = useState<string[]>([]);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) for (const id of new Set(e.lines.map((l) => l.accountId))) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [entries]);

  const add = () => {
    const r = addAccount({ name, type, number: suggestAccountNumber(accounts, type) });
    if (r.ok) {
      setName('');
      setErrors([]);
    } else setErrors(r.errors);
  };

  const remove = (a: Account) =>
    undoable(`Deleted account “${a.name}”`, () => {
      const r = deleteAccount(a.id);
      setErrors(r.ok ? [] : r.errors);
      return r.ok;
    });

  const blocked = (a: Account) =>
    a.systemKey === SYSTEM_KEYS.openingBalanceEquity
      ? 'Needed to balance opening balances'
      : usage.get(a.id)
        ? 'Used in journal entries, so it can’t be deleted'
        : '';

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>Chart of accounts</SectionTitle>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input aria-label="New account name" className={cx(inputClass, 'flex-[2] py-2 text-base')} placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} />
        <select aria-label="New account type" className={cx(inputClass, 'flex-1 py-2 text-base')} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Add
        </Button>
      </form>
      <div className="mt-2">
        <ErrorList errors={errors} />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="data-table w-full min-w-[32rem] text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr className="border-b border-slate-400/30">
              <th className="px-2.5 py-2">Name</th>
              <th className="px-2.5 py-2">Type</th>
              <th className="px-2.5 py-2">Use</th>
              <th className="w-24 px-2.5 py-2">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400/20">
            {sortAccounts(accounts).map((a) => {
              const why = blocked(a);
              const used = usage.get(a.id) ?? 0;
              return (
                <tr key={a.id}>
                  <td className="px-2.5 py-2.5 text-slate-900">{a.name}</td>
                  <td className="px-2.5 py-2.5 text-slate-600">{TYPE_LABELS[a.type]}</td>
                  <td className="px-2.5 py-2.5 text-slate-600">{used ? `${used} ${used === 1 ? 'entry' : 'entries'}` : '—'}</td>
                  <td className="px-2.5 py-1.5 text-right">
                    <button
                      type="button"
                      aria-label={`Delete ${a.name}`}
                      title={why || `Delete ${a.name}`}
                      disabled={!!why}
                      onClick={() => remove(a)}
                      className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Opening statement

function OpeningStatementCard() {
  const { accounts, entries } = useBooks();
  const os = useMemo(() => openingStatement(accounts, entries), [accounts, entries]);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>Opening statement</SectionTitle>
        <a href="#/settings" onClick={(e) => { e.preventDefault(); document.getElementById('opening-balances')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sm font-medium text-cyan-700 hover:underline">
          {os ? 'Edit opening balances ↑' : 'Enter opening balances ↑'}
        </a>
      </div>
      <p className="mt-1 text-sm text-slate-600">The position you started the books with, before any transactions.</p>
      <div className="mt-4">
        {os ? (
          <BalanceSheetBody bs={os} title="Opening Statement" period={`As of ${fmtDate(os.asOf)}`} showNetIncome={false} compact />
        ) : (
          <p className="text-sm text-slate-500">No opening balances yet.</p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- AI

function AiCard() {
  const { aiProvider, apiKeys, aiMode, setProvider, setApiKey, setAiMode } = useSettings();
  const accounts = useBooks((s) => s.accounts);
  const savedKey = apiKeys[aiProvider];
  const info = PROVIDERS[aiProvider];
  const [draft, setDraft] = useState(savedKey);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ParseResult | null>(null);

  // Switching provider shows that provider's saved key.
  useEffect(() => {
    setDraft(savedKey);
    setSaved(false);
    setTest(null);
  }, [aiProvider, savedKey]);

  const dirty = draft.trim() !== savedKey;
  const looksWrong = aiProvider === 'anthropic' && draft.trim() !== '' && !draft.trim().startsWith('sk-ant-');

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const r = await lazyAiParser(aiProvider, savedKey).parse(TEST_SENTENCE, { accounts, today: todayISO() });
    setTest(r);
    setTesting(false);
  };

  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>AI transaction recognizer</SectionTitle>
      <p className="mt-1 text-sm text-slate-600">
        Add an API key and the AI will turn sentences the built-in rules don’t understand into journal entries. You still review every entry before it’s
        saved.
      </p>

      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-slate-600">AI provider</div>
        <Segmented
          label="AI provider"
          value={aiProvider}
          onChange={setProvider}
          options={(Object.keys(PROVIDERS) as AiProvider[]).map((p) => ({ value: p, label: PROVIDERS[p].name + (apiKeys[p] ? ' ✓' : '') }))}
        />
        <p className="mt-2 text-xs text-slate-500">
          Uses {info.model}. {info.note}
        </p>
      </div>

      <div className="mt-5 max-w-xl space-y-2">
        <Field label={`${info.name} API key`}>
          <div className="flex gap-2">
            <input
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              className={cx(inputClass, 'font-mono')}
              placeholder="Paste your API key"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setSaved(false);
                setTest(null);
              }}
            />
            <Button onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</Button>
          </div>
        </Field>
        {looksWrong && <p className="text-sm text-amber-700">Anthropic API keys usually start with “sk-ant-”.</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!dirty || !draft.trim()}
            onClick={() => {
              setApiKey(aiProvider, draft);
              setSaved(true);
            }}
          >
            Save key
          </Button>
          {savedKey && (
            <Button
              variant="danger"
              onClick={() => {
                setApiKey(aiProvider, '');
                setDraft('');
                setTest(null);
                setSaved(false);
              }}
            >
              Remove key
            </Button>
          )}
          {savedKey && !dirty && (
            <Button onClick={runTest} disabled={testing}>
              {testing ? 'Testing…' : 'Test the AI'}
            </Button>
          )}
        </div>
        {saved && !dirty && <p className="text-sm text-cyan-700">Key saved in this browser.</p>}
        <p className="text-xs text-slate-500">
          {info.keyHint} Get one at{' '}
          <a className="underline" href={info.keyUrl} target="_blank" rel="noreferrer">
            {new URL(info.keyUrl).host}
          </a>
          .
        </p>
      </div>

      {test && (
        <div
          data-testid="ai-test-result"
          className={cx('mt-4 max-w-xl rounded-2xl px-4 py-3 text-sm', test.status === 'matched' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800')}
        >
          <div className="font-medium">Test: “{TEST_SENTENCE}”</div>
          {test.status === 'matched' ? (
            <ul className="mt-1 space-y-0.5">
              {test.lines.map((l, i) => (
                <li key={i} className="tabular-nums">
                  {l.debit ? 'Dr' : 'Cr'} {name(l.accountId)} {formatCents(l.debit || l.credit)}
                </li>
              ))}
              <li className="pt-1">✓ The AI is working.</li>
            </ul>
          ) : (
            <p className="mt-1">{test.reason}</p>
          )}
        </div>
      )}

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-slate-600">When to use AI</legend>
        <div className="mt-2 space-y-2">
          {MODES.map((m) => (
            <label key={m.value} className="field flex cursor-pointer gap-3 rounded-2xl p-3 text-sm">
              <input type="radio" name="ai-mode" className="mt-0.5 accent-cyan-700" checked={aiMode === m.value} onChange={() => setAiMode(m.value)} />
              <span>
                <span className="font-medium text-slate-900">{m.label}</span>
                <span className="block text-slate-500">{m.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field mt-6 rounded-2xl p-3 text-xs text-slate-600">
        <strong className="text-slate-700">Privacy:</strong> keys are stored only in this browser (localStorage) and sent only to the provider you choose.
        When the AI is used, the sentence you typed and your chart of accounts (names and numbers, no balances) are sent with it. Don’t save a key on a
        shared or public computer.
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Appearance & books

const ACCENT_CHOICES: { value: AccentPref; label: string; swatch: string }[] = [
  { value: 'default', label: 'Default', swatch: '#12795c' },
  { value: 'blue', label: 'Blue', swatch: '#2563eb' },
  { value: 'purple', label: 'Purple', swatch: '#7c3aed' },
  { value: 'orange', label: 'Orange', swatch: '#ea580c' },
  { value: 'pink', label: 'Pink', swatch: '#db2777' },
];

function LayoutCard() {
  const { tabPosition, textSize, accent, density, hiddenTabs, startPage, showIntro, setShowIntro, setTabPosition, setTextSize, setAccent, setDensity, setTabHidden, setStartPage } =
    useSettings();
  const shown = ALL_TABS.filter((t) => t.to === '/settings' || !hiddenTabs.includes(t.to));
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>Layout and tabs</SectionTitle>
      <div className="mt-3 flex flex-wrap gap-x-10 gap-y-5">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Tabs go</div>
          <Segmented
            label="Tab position"
            value={tabPosition}
            onChange={setTabPosition}
            options={[
              { value: 'top', label: 'On top' },
              { value: 'side', label: 'On the side' },
            ]}
          />
          <p className="mt-2 max-w-xs text-xs text-slate-500">The side bar shows on wide screens; phones always use the Menu button.</p>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Text size</div>
          <Segmented
            label="Text size"
            value={textSize}
            onChange={setTextSize}
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Normal' },
              { value: 'lg', label: 'Large' },
              { value: 'xl', label: 'Extra large' },
            ]}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Spacing</div>
          <Segmented
            label="Spacing"
            value={density}
            onChange={setDensity}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Accent color</div>
          <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
            {ACCENT_CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={accent === c.value}
                onClick={() => setAccent(c.value)}
                className={cx('field flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3 text-sm font-medium text-slate-700', accent === c.value && 'ring-2 ring-cyan-500')}
              >
                <span className="h-4 w-4 rounded-full" style={{ background: c.swatch }} />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="mt-6 flex items-center gap-2 text-sm text-slate-800">
        <input type="checkbox" className="h-4 w-4 accent-cyan-600" checked={showIntro} onChange={(e) => setShowIntro(e.target.checked)} />
        Play the opening intro when the app starts
      </label>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Tabs to show</div>
          <div className="space-y-1.5">
            {ALL_TABS.map((t) => (
              <label key={t.to} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-cyan-600"
                  checked={t.to === '/settings' || !hiddenTabs.includes(t.to)}
                  disabled={t.to === '/settings'}
                  onChange={(e) => setTabHidden(t.to, !e.target.checked)}
                />
                {t.label}
                {t.to === '/settings' && <span className="text-xs text-slate-500">(always on)</span>}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Open the app on</div>
          <select
            aria-label="Open the app on"
            className={inputClass}
            value={shown.some((t) => t.to === startPage) ? startPage : shown[0].to}
            onChange={(e) => setStartPage(e.target.value)}
          >
            {shown.map((t) => (
              <option key={t.to} value={t.to}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}

function AppearanceCard() {
  const { theme, style, design, setTheme, setStyle, setDesign } = useSettings();
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>Appearance</SectionTitle>
      <div className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Design</div>
          <Segmented label="Design" value={design} onChange={setDesign} options={DESIGNS} />
          <p className="mt-2 max-w-xs text-xs text-slate-500">
            {design === 'apple'
              ? 'A clean look with a frosted top bar, big headlines, white cards on gray and blue buttons.'
              : 'Mint gradient, serif headings and deep-green buttons.'}
          </p>
        </div>
        {design === 'classic' && (
          <div>
            <div className="mb-2 text-sm font-medium text-slate-600">Background</div>
            <Segmented label="Background" value={style} onChange={setStyle} options={STYLES} />
          </div>
        )}
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">Light or dark</div>
          <Segmented label="Theme" value={theme} onChange={setTheme} options={THEMES} />
        </div>
      </div>
    </Card>
  );
}

function BooksCard() {
  const { accounts, entries, nextSeq, loadSample, reset, restore } = useBooks();
  const { theme, style, design, setTheme, setStyle, setDesign } = useSettings();
  const { entryDate, periodFrom, lastBackupAt, setEntryDate, setPeriodFrom, setLastBackupAt } = useCompany();
  const companyName = useCompanyName();
  const activeId = useCompanies((s) => s.activeId);
  const failed = useSaveStatus((s) => s.failed);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [protectedStorage, setProtectedStorage] = useState<boolean | 'unsupported'>('unsupported');

  useEffect(() => {
    if (navigator.storage?.persisted) void navigator.storage.persisted().then(setProtectedStorage);
  }, []);

  const download = () => {
    const now = new Date();
    const backup = makeBackup({ accounts, entries, nextSeq }, { companyName, entryDate, periodFrom, theme, style, design }, now);
    downloadFile(backupFilename(now), JSON.stringify(backup, null, 2), 'application/json');
    setLastBackupAt(now.toISOString());
    setErrors([]);
    setMessage('Backup downloaded. Keep the file somewhere safe, like your Downloads folder, cloud drive or email.');
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    const r = parseBackup(await file.text());
    if (fileRef.current) fileRef.current.value = '';
    if (!r.ok) return setErrors([r.reason]);
    // One click: the Undo bar puts the previous books back.
    undoable('Restored the backup', () => {
      restore(r.books);
      if (r.settings.companyName) renameCompany(activeId, r.settings.companyName);
      setEntryDate(r.settings.entryDate);
      setPeriodFrom(r.settings.periodFrom);
      setTheme(r.settings.theme);
      setStyle(r.settings.style);
      setDesign(r.settings.design);
    });
    setErrors([]);
    setMessage(`Restored ${r.entryCount} journal ${r.entryCount === 1 ? 'entry' : 'entries'} and ${r.accountCount} accounts from the backup.`);
  };

  const protect = async () => {
    try {
      const granted = await navigator.storage.persist();
      setProtectedStorage(granted);
      setMessage(granted ? 'Done. Your browser will keep this data unless you clear it yourself.' : "Your browser said no this time. Download a backup to be safe.");
    } catch {
      setMessage("Couldn't ask the browser. Download a backup to be safe.");
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>Your books</SectionTitle>
      <p className="mt-1 text-sm text-slate-600">
        These are the books for <strong>{companyName}</strong>. Everything is saved in <strong>this browser only</strong>. It doesn't sync to other browsers or devices, and clearing the site's data erases it, so download
        a backup now and then.
      </p>

      {failed && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          This browser is refusing to save right now (a private window or full storage). Download a backup so you don't lose your work.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={download}>
          Download backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Backup file to restore"
          onChange={(e) => void chooseFile(e.target.files?.[0])}
        />
        <Button onClick={() => fileRef.current?.click()}>Restore from backup</Button>
        <span className="text-sm text-slate-600">{lastBackupAt ? `Last backup: ${fmtDate(lastBackupAt.slice(0, 10))}` : 'No backup yet'}</span>
      </div>

      {protectedStorage !== 'unsupported' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span>
            Browser protection: <strong>{protectedStorage ? 'on (the browser won’t clear this data on its own)' : 'off (the browser may clear it if space runs low)'}</strong>
          </span>
          {!protectedStorage && <Button onClick={() => void protect()}>Ask the browser to keep it</Button>}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <ErrorList errors={errors} />
        {message && <p className="text-sm text-cyan-700">{message}</p>}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-400/25 pt-4">
        <Button onClick={() => undoable('Loaded the sample data', loadSample)}>Load sample data</Button>
        <Button variant="danger" onClick={() => undoable('Reset the books', reset)}>
          Reset books
        </Button>
      </div>
    </Card>
  );
}

export function Settings() {
  const location = useLocation();
  const openingRef = useRef<HTMLDivElement>(null);
  // Remount the opening balances form when the opening entry is removed or brought back (Undo), so it shows the right amounts.
  const openingId = useBooks((st) => st.entries.find((e) => e.kind === 'opening')?.id ?? 'none');
  // Arriving from the Journal's "Opening balances" button or the company switcher scrolls straight to that section.
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    const t = setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => clearTimeout(t);
  }, [location.state]);

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <CompaniesCard />
      <ChartOfAccountsCard />
      <OpeningBalancesCard key={openingId} ref={openingRef} />
      <OpeningStatementCard />
      <AiCard />
      <AppearanceCard />
      <LayoutCard />
      <BooksCard />
    </div>
  );
}
