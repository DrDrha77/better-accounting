import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppleJournal } from '../components/AppleJournal';
import { useIsApple } from '../components/apple';
import { EntryEditor } from '../components/EntryEditor';
import { cx, fmtDate, formatPlain } from '../components/format';
import { HighlightMenu } from '../components/HighlightMenu';
import { SavedJournalsMenu } from '../components/SavedJournalsMenu';
import { QuickPost } from '../components/QuickPost';
import { SaveForDate } from '../components/SaveForDate';
import { ScanPage } from '../components/ScanPage';
import { ReportShell } from '../components/ReportShell';
import { TransactionComposer } from '../components/TransactionComposer';
import { Button, Card, Field, inputClass } from '../components/ui';
import { centsToCsv } from '../engine/csv';
import { entryNumberLabel, sortEntries } from '../engine/journal';
import { filterEntries } from '../engine/ledger';
import type { JournalEntry } from '../engine/types';
import { undoable } from '../store/companyActions';
import { useBooks } from '../store/useBooks';
import { useCompany } from '../store/useCompany';

/** Toolbar buttons are a bit larger, like the rest of the Journal page. */
const TOOL = 'px-5 py-2.5 text-[15px]';

export function Journal() {
  const { accounts, entries, updateEntry, deleteEntry, clearJournal } = useBooks();
  const navigate = useNavigate();
  const apple = useIsApple();
  const [editing, setEditing] = useState<string | null>(null);
  const periodFrom = useCompany((s) => s.periodFrom);
  const [from, setFrom] = useState(periodFrom);
  const [to, setTo] = useState('');
  const [showComposer, setShowComposer] = useState(true);
  const [blankDraft, setBlankDraft] = useState(0);
  // Accounts whose entries should stand out; entries that don't use them fade back.
  const [highlight, setHighlight] = useState<Set<string>>(() => new Set());

  const sorted = useMemo(() => sortEntries(filterEntries(entries, { from: from || undefined, to: to || undefined })), [entries, from, to]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const name = (id: string) => byId.get(id)?.name ?? 'Unknown account';
  const number = (id: string) => byId.get(id)?.number ?? '';
  const postedCount = entries.filter((e) => e.kind !== 'opening').length;

  const csvRows = () => [
    ['Entry', 'Date', 'Description', 'PR (Account #)', 'Account', 'Debit', 'Credit'],
    ...sorted.flatMap((e) =>
      e.lines.map((l) => [entryNumberLabel(e), e.date, e.description, number(l.accountId), name(l.accountId), centsToCsv(l.debit, true), centsToCsv(l.credit, true)]),
    ),
  ];

  // One click, no dialog: the Undo bar reverses these.
  const clear = () => {
    if (!postedCount) return;
    undoable(`Cleared ${postedCount} journal ${postedCount === 1 ? 'entry' : 'entries'}`, () => {
      clearJournal();
    });
  };
  const removeEntry = (e: JournalEntry) =>
    undoable(`Deleted entry ${entryNumberLabel(e)} “${e.description}”`, () => {
      deleteEntry(e.id);
    });

  const hl = highlight;
  const lineHit = (accountId: string) => hl.has(accountId);
  const entryHit = (e: { lines: { accountId: string }[] }) => e.lines.some((l) => hl.has(l.accountId));
  const hitCount = hl.size ? sorted.filter(entryHit).length : 0;
  const hitNames = [...hl].map((id) => byId.get(id)?.name).filter(Boolean) as string[];

  return (
    <ReportShell
      title="Journal"
      subtitle="Post entries here. All statements update from the same books."
      csvName="general-journal.csv"
      csvRows={csvRows}
      filters={
        <>
          <Field label="From">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button className={TOOL} onClick={() => setShowComposer((s) => !s)}>
            {showComposer ? 'Hide composer' : 'Show composer'}
          </Button>
          <Button className={TOOL} onClick={() => navigate('/settings', { state: { scrollTo: 'opening-balances' } })}>
            Opening balances
          </Button>
          <Button
            className={TOOL}
            onClick={() => {
              setShowComposer(true);
              setBlankDraft(Date.now());
            }}
          >
            Blank draft
          </Button>
          <SaveForDate className={TOOL} />
          <HighlightMenu className={TOOL} accounts={accounts} selected={highlight} onChange={setHighlight} />
          <SavedJournalsMenu className={TOOL} />
          <Button className={TOOL} variant="danger" onClick={clear} disabled={!postedCount}>
            Clear journal
          </Button>
        </>
      }
    >
      <div className="collapse-panel mb-5 print:hidden" data-open={showComposer} aria-hidden={!showComposer} {...(showComposer ? {} : { inert: '' })}>
        <div>
        <Card className="space-y-6 p-5">
          <div>
            <div className="text-base font-semibold text-slate-900">Describe it</div>
            <p className="mb-3 text-sm text-slate-500">Type it in plain English, like “Bought a car for 4000”, and check the entry before it’s saved.</p>
            <TransactionComposer examples={[]} showManualLink={false} blankDraftSignal={blankDraft} />
          </div>
          <div className="border-t border-slate-400/25 pt-5">
            <QuickPost />
          </div>
          <div className="border-t border-slate-400/25 pt-5">
            <ScanPage />
          </div>
        </Card>
        </div>
      </div>

      {hl.size > 0 && (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-amber-400/20 px-4 py-2 text-sm text-slate-800 ring-1 ring-amber-500/40 print:hidden">
          <span>
            Highlighting <strong>{hitNames.slice(0, 3).join(', ')}{hitNames.length > 3 ? ` +${hitNames.length - 3}` : ''}</strong>: {hitCount} of {sorted.length}{' '}
            {sorted.length === 1 ? 'entry uses' : 'entries use'} {hl.size === 1 ? 'it' : 'at least one of them'}. Other entries are faded.
          </span>
          <button type="button" className="font-semibold text-cyan-700 hover:underline" onClick={() => setHighlight(new Set())}>
            Clear highlight
          </button>
        </div>
      )}

      {apple ? (
        <>
          {(from || to) && (
            <p className="mb-3 px-2 text-sm text-slate-500">
              Showing {from ? fmtDate(from) : 'the beginning'} – {to ? fmtDate(to) : 'today'}
            </p>
          )}
          <AppleJournal
            entries={sorted}
            accounts={accounts}
            editing={editing}
            setEditing={setEditing}
            onUpdate={(id, d) => {
              const r = updateEntry(id, d);
              if (r.ok) setEditing(null);
              return r;
            }}
            onDelete={removeEntry}
            highlight={highlight}
            emptyText={entries.length ? 'No entries in this date range.' : 'No entries yet. Post above, or describe a transaction in plain English.'}
          />
        </>
      ) : (
      <Card className="overflow-x-auto rounded-xl">
        <div className="bg-slate-400/10 px-4 py-3.5 text-center text-lg font-bold text-slate-900">
          General Journal
          {(from || to) && (
            <div className="text-xs font-normal text-slate-600">
              {from ? fmtDate(from) : 'Beginning'} – {to ? fmtDate(to) : 'today'}
            </div>
          )}
        </div>
        <table className="journal-table w-full min-w-[44rem] text-sm">
            <thead className="text-center text-sm font-bold text-slate-900">
              <tr>
                <th className="w-[14%] px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="w-[8%] px-2 py-3">PR</th>
                <th className="w-[15%] px-4 py-3">Amount (Dr. $)</th>
                <th className="w-[15%] px-4 py-3">Amount (Cr. $)</th>
                <th className="w-24 px-2 py-3 print:hidden">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-sm text-slate-600">
                    {entries.length ? 'No entries in this date range.' : 'No entries yet. Post above, or describe a transaction in plain English.'}
                  </td>
                </tr>
              )}
              {sorted.map((e) => (
                <Fragment key={e.id}>
                  {e.lines.map((l, i) => (
                    <tr
                      key={i}
                      className={cx(
                        i === 0 && 'border-t border-slate-400/25',
                        hl.size > 0 && (lineHit(l.accountId) ? 'bg-amber-400/30 font-semibold' : !entryHit(e) && 'opacity-35'),
                      )}
                    >
                      <td className="whitespace-nowrap px-4 pt-2 align-top text-slate-600">
                        {i === 0 && (
                          <>
                            {fmtDate(e.date)}
                            <span className="ml-1.5 font-mono text-[10px] text-slate-400">{entryNumberLabel(e)}</span>
                          </>
                        )}
                      </td>
                      <td className={l.credit ? 'px-4 pl-12 pt-1' : 'px-4 pt-1'}>{name(l.accountId)}</td>
                      <td className="px-2 pt-1 text-center tabular-nums text-slate-500">{number(l.accountId)}</td>
                      <td className="px-4 pt-1 text-right tabular-nums">{formatPlain(l.debit, true)}</td>
                      <td className="px-4 pt-1 text-right tabular-nums">{formatPlain(l.credit, true)}</td>
                      <td className="px-4 pt-1 text-right align-top print:hidden">
                        {i === 0 &&
                          (e.kind === 'opening' ? (
                            <Link to="/opening-balances" className="text-xs text-cyan-700 hover:underline">
                              Edit
                            </Link>
                          ) : (
                            <span className="whitespace-nowrap">
                              <button type="button" className="text-xs text-cyan-700 hover:underline" onClick={() => setEditing(e.id)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="ml-3 text-xs text-red-600 hover:underline"
                                onClick={() => removeEntry(e)}
                              >
                                Delete
                              </button>
                            </span>
                          ))}
                      </td>
                    </tr>
                  ))}
                  <tr className={cx(hl.size > 0 && !entryHit(e) && 'opacity-35')}>
                    <td />
                    <td className="px-4 pb-3 pl-8 pt-0.5 text-xs italic text-slate-500" colSpan={4}>
                      ({e.description})
                      {e.kind === 'opening' && <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 not-italic text-sky-700">Opening balance</span>}
                    </td>
                    <td className="print:hidden" />
                  </tr>
                  {editing === e.id && (
                    <tr className="print:hidden">
                      <td colSpan={6} className="bg-slate-400/10 px-4 py-4">
                        <EntryEditor
                          accounts={accounts}
                          initial={e}
                          saveLabel="Save changes"
                          onCancel={() => setEditing(null)}
                          onSave={(d) => {
                            const r = updateEntry(e.id, d);
                            if (r.ok) setEditing(null);
                            return r;
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
        </table>
      </Card>
      )}
    </ReportShell>
  );
}
