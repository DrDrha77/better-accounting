import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, formatCents } from '../components/format';
import { TransactionComposer } from '../components/TransactionComposer';
import { Card, StatusBadge } from '../components/ui';
import { findBySystemKey, SYSTEM_KEYS } from '../engine/accounts';
import { entryNumberLabel } from '../engine/journal';
import { ledgerFor } from '../engine/ledger';
import { balanceSheet, trialBalance } from '../engine/reports';
import { useBooks } from '../store/useBooks';

export function Dashboard() {
  const { accounts, entries, loadSample } = useBooks();

  const stats = useMemo(() => {
    const cash = findBySystemKey(accounts, SYSTEM_KEYS.cash);
    const bs = balanceSheet(accounts, entries);
    const tb = trialBalance(accounts, entries);
    return { cash: cash ? ledgerFor(cash, entries).balance : 0, bs, tb };
  }, [accounts, entries]);

  const recent = useMemo(() => [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6), [entries]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add a transaction</h1>
        <p className="mt-1 text-sm text-slate-500">Describe what happened in plain English. You'll confirm the journal entry before anything is saved.</p>
      </div>

      <Card className="p-5">
        <TransactionComposer autoFocus />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cash" value={formatCents(stats.cash)} />
        <Stat label="Total assets" value={formatCents(stats.bs.totalAssets)} />
        <Stat label="Net income (to date)" value={formatCents(stats.bs.netIncome)} />
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Trial balance</div>
          <div className="mt-2">
            <StatusBadge ok={stats.tb.balanced} okText="Balanced ✓" badText={`Off by ${formatCents(Math.abs(stats.tb.difference))}`} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-400/25 px-5 py-3">
          <h2 className="font-medium text-slate-900">Recent entries</h2>
          <Link to="/journal" className="text-sm text-cyan-700 hover:underline">
            All entries →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No entries yet. Type a transaction above, enter <Link className="text-cyan-700 underline" to="/opening-balances">opening balances</Link>, or{' '}
            <button type="button" className="text-cyan-700 underline" onClick={loadSample}>
              load sample data
            </button>
            .
          </div>
        ) : (
          <ul className="divide-y divide-slate-400/15">
            {recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-10 font-mono text-xs text-slate-400">{entryNumberLabel(e)}</span>
                <span className="w-24 text-slate-500">{fmtDate(e.date)}</span>
                <span className="min-w-0 flex-1 font-medium text-slate-800">{e.description}</span>
                <span className="text-slate-500">
                  {e.lines
                    .map((l) => `${l.debit ? 'Dr' : 'Cr'} ${byId.get(l.accountId)?.name ?? '?'}`)
                    .join(' · ')}
                </span>
                <span className="w-28 text-right tabular-nums text-slate-900">{formatCents(e.lines.reduce((s, l) => s + l.debit, 0))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
    </Card>
  );
}
