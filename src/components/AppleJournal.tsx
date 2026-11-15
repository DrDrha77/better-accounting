import { Link } from 'react-router-dom';
import { entryNumberLabel } from '../engine/journal';
import type { Account, EntryDraft, JournalEntry } from '../engine/types';
import type { ActionResult } from '../store/useBooks';
import { EntryEditor } from './EntryEditor';
import { fmtDate, formatCents, formatPlain } from './format';

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export interface MonthGroup {
  key: string;
  label: string;
  entries: JournalEntry[];
}

/** Entries (already in date order) grouped by calendar month. */
export function groupByMonth(entries: JournalEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: monthFmt.format(new Date(`${key}-01T00:00:00Z`)), entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}

/**
 * The Journal in the Apple-style design: one rounded card per month, one row per entry with the
 * description and total on top and the debit / credit lines underneath (credits indented, as in a
 * textbook journal).
 */
export function AppleJournal({
  entries,
  accounts,
  editing,
  setEditing,
  onUpdate,
  onDelete,
  emptyText,
}: {
  entries: JournalEntry[];
  accounts: Account[];
  editing: string | null;
  setEditing: (id: string | null) => void;
  onUpdate: (id: string, draft: EntryDraft) => ActionResult;
  onDelete: (entry: JournalEntry) => void;
  emptyText: string;
}) {
  const byId = new Map(accounts.map((a) => [a.id, a]));

  if (!entries.length) return <div className="card rounded-3xl p-8 text-center text-[15px] text-slate-500">{emptyText}</div>;

  return (
    <div className="space-y-8">
      {groupByMonth(entries).map((g) => (
        <section key={g.key}>
          <h3 className="mb-2 px-2 text-2xl font-semibold tracking-tight text-slate-900">{g.label}</h3>
          <div className="card divide-y divide-slate-400/20 overflow-hidden rounded-3xl">
            {g.entries.map((e) => {
              const total = e.lines.reduce((s, l) => s + l.debit, 0);
              return (
                <article key={e.id} className="px-5 py-4 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[17px] font-semibold leading-snug text-slate-900">
                        {e.description}
                        {e.kind === 'opening' && (
                          <span className="ml-2 rounded-full bg-cyan-700/10 px-2 py-0.5 align-middle text-xs font-medium text-cyan-700">Opening balance</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {fmtDate(e.date)} · {entryNumberLabel(e)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[17px] font-semibold tabular-nums text-slate-900">{formatCents(total)}</div>
                      <div className="mt-0.5 flex justify-end gap-3 text-xs font-medium print:hidden">
                        {e.kind === 'opening' ? (
                          <Link to="/settings" state={{ scrollTo: 'opening-balances' }} className="text-cyan-700 hover:underline">
                            Edit
                          </Link>
                        ) : (
                          <>
                            <button type="button" className="text-cyan-700 hover:underline" onClick={() => setEditing(e.id)}>
                              Edit
                            </button>
                            <button type="button" className="text-red-600 hover:underline" onClick={() => onDelete(e)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1.5 rounded-2xl bg-slate-400/10 px-4 py-3 text-[15px]">
                    {e.lines.map((l, i) => (
                      <li key={i} className={`flex items-baseline gap-3 ${l.credit ? 'pl-5' : ''}`}>
                        <span className="w-6 shrink-0 text-xs font-semibold text-slate-500">{l.debit ? 'Dr' : 'Cr'}</span>
                        <span className="min-w-0 flex-1 text-slate-800">
                          {byId.get(l.accountId)?.name ?? 'Unknown account'}
                          <span className="ml-2 text-xs text-slate-500">{byId.get(l.accountId)?.number}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-800">{formatPlain(l.debit || l.credit)}</span>
                      </li>
                    ))}
                  </ul>

                  {editing === e.id && (
                    <div className="mt-4 print:hidden">
                      <EntryEditor accounts={accounts} initial={e} saveLabel="Save changes" onCancel={() => setEditing(null)} onSave={(d) => onUpdate(e.id, d)} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
