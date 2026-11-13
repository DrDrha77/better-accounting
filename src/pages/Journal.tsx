import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EntryEditor } from '../components/EntryEditor';
import { fmtDate, formatPlain } from '../components/format';
import { QuickPost } from '../components/QuickPost';
import { ReportShell } from '../components/ReportShell';
import { TransactionComposer } from '../components/TransactionComposer';
import { Button, Card, EmptyState, Field, inputClass } from '../components/ui';
import { centsToCsv } from '../engine/csv';
import { entryNumberLabel, sortEntries } from '../engine/journal';
import { filterEntries } from '../engine/ledger';
import { useBooks } from '../store/useBooks';

export function Journal() {
  const { accounts, entries, updateEntry, deleteEntry, clearJournal } = useBooks();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showComposer, setShowComposer] = useState(true);
  const [blankDraft, setBlankDraft] = useState(0);

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

  const clear = () => {
    if (!postedCount) return;
    if (window.confirm(`Delete all ${postedCount} journal ${postedCount === 1 ? 'entry' : 'entries'}? Your accounts and opening balances are kept. This can't be undone.`))
      clearJournal();
  };

  return (
    <ReportShell
      title="General Journal"
      subtitle="Your main entry point. Post here and the Ledger, T-Accounts, Trial Balance, Income Statement and Balance Sheet all update from the same entries."
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
          <Button onClick={() => setShowComposer((s) => !s)}>{showComposer ? 'Hide composer' : 'Show composer'}</Button>
          <Button onClick={() => navigate('/opening-balances')}>Opening balances</Button>
          <Button
            onClick={() => {
              setShowComposer(true);
              setBlankDraft(Date.now());
            }}
          >
            Blank draft
          </Button>
          <Button variant="danger" onClick={clear} disabled={!postedCount}>
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
        </Card>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <div className="journal-title px-4 pt-4 text-center text-lg font-bold text-slate-900">General Journal</div>
        {(from || to) && (
          <div className="text-center text-xs text-slate-500">
            {from ? fmtDate(from) : 'Beginning'} – {to ? fmtDate(to) : 'today'}
          </div>
        )}
        {sorted.length === 0 ? (
          <div className="p-4">
            <EmptyState>
              {entries.length ? 'No entries in this date range.' : 'No entries yet. Post above, or describe a transaction in plain English.'}
            </EmptyState>
          </div>
        ) : (
          <table className="journal-table mt-3 w-full min-w-[44rem] text-sm">
            <thead className="border-y border-slate-400/40 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="w-28 px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="w-16 px-2 py-2 text-center">PR</th>
                <th className="w-32 px-4 py-2 text-right">Debit ($)</th>
                <th className="w-32 px-4 py-2 text-right">Credit ($)</th>
                <th className="w-28 px-4 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <Fragment key={e.id}>
                  {e.lines.map((l, i) => (
                    <tr key={i} className={i === 0 ? 'border-t border-slate-400/25' : ''}>
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
                                onClick={() => {
                                  if (window.confirm(`Delete entry ${entryNumberLabel(e)} “${e.description}”?`)) deleteEntry(e.id);
                                }}
                              >
                                Delete
                              </button>
                            </span>
                          ))}
                      </td>
                    </tr>
                  ))}
                  <tr>
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
        )}
      </Card>
    </ReportShell>
  );
}
