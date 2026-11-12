import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EntryEditor } from '../components/EntryEditor';
import { fmtDate, formatPlain } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { Button, Card, EmptyState } from '../components/ui';
import { centsToCsv } from '../engine/csv';
import { entryNumberLabel, sortEntries } from '../engine/journal';
import { useBooks } from '../store/useBooks';

export function Journal() {
  const { accounts, entries, updateEntry, deleteEntry } = useBooks();
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = useMemo(() => sortEntries(entries), [entries]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const name = (id: string) => byId.get(id)?.name ?? 'Unknown account';

  const csvRows = () => [
    ['Entry', 'Date', 'Description', 'Account #', 'Account', 'Debit', 'Credit'],
    ...sorted.flatMap((e) =>
      e.lines.map((l) => [entryNumberLabel(e), e.date, e.description, byId.get(l.accountId)?.number, name(l.accountId), centsToCsv(l.debit, true), centsToCsv(l.credit, true)]),
    ),
  ];

  return (
    <ReportShell title="General Journal" subtitle="Every entry in chronological order — the source of all other reports." csvName="general-journal.csv" csvRows={csvRows}>
      {sorted.length === 0 ? (
        <EmptyState>No journal entries yet.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-400/10 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Account / Description</th>
                <th className="px-4 py-2 text-right font-medium">Debit</th>
                <th className="px-4 py-2 text-right font-medium">Credit</th>
                <th className="px-4 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <Fragment key={e.id}>
                  {e.lines.map((l, i) => (
                    <tr key={i} className={i === 0 ? 'border-t border-slate-400/25' : ''}>
                      <td className="px-4 pt-2 align-top font-mono text-xs text-slate-400">{i === 0 && entryNumberLabel(e)}</td>
                      <td className="whitespace-nowrap px-4 pt-2 align-top text-slate-600">{i === 0 && fmtDate(e.date)}</td>
                      <td className={l.credit ? 'px-4 pl-12 pt-1' : 'px-4 pt-1'}>{name(l.accountId)}</td>
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
                    <td />
                    <td className="px-4 pb-3 pt-0.5 text-xs italic text-slate-500" colSpan={3}>
                      {e.description}
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
      {editing && (
        <div className="mt-3 print:hidden">
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Close editor
          </Button>
        </div>
      )}
    </ReportShell>
  );
}
