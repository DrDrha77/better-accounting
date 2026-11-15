import { useMemo, useState } from 'react';
import { ListSection, StatTiles, useIsApple } from '../components/apple';
import { cx, fmtDate, formatCents, formatPlain } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { Card, EmptyState, Field, inputClass, StatusBadge } from '../components/ui';
import { centsToCsv } from '../engine/csv';
import { trialBalance } from '../engine/reports';
import { useBooks } from '../store/useBooks';

export function TrialBalance() {
  const { accounts, entries } = useBooks();
  const [asOf, setAsOf] = useState('');
  const apple = useIsApple();
  const tb = useMemo(() => trialBalance(accounts, entries, asOf || undefined), [accounts, entries, asOf]);

  const csvRows = () => [
    ['Trial Balance', asOf ? `As of ${asOf}` : 'All dates'],
    ['Account #', 'Account', 'Debit', 'Credit'],
    ...tb.rows.map((r) => [r.account.number, r.account.name, centsToCsv(r.debit, true), centsToCsv(r.credit, true)]),
    ['', 'Totals', centsToCsv(tb.totalDebit), centsToCsv(tb.totalCredit)],
  ];

  return (
    <ReportShell
      title="Trial Balance"
      subtitle={asOf ? `As of ${fmtDate(asOf)}` : 'All dates'}
      csvName="trial-balance.csv"
      csvRows={csvRows}
      filters={
        <Field label="As of (optional)">
          <input type="date" className={inputClass} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
      }
    >
      {apple && (
        <div className="mb-4">
          <StatTiles
            tiles={[
              { label: 'Total debits', cents: tb.totalDebit },
              { label: 'Total credits', cents: tb.totalCredit },
            ]}
          />
        </div>
      )}
      <div className={cx('mb-4', apple && 'flex justify-center')}>
        <StatusBadge ok={tb.balanced} okText="Balanced ✓" badText={`Out of balance by ${formatCents(Math.abs(tb.difference))}`} />
      </div>
      {tb.rows.length === 0 ? (
        <EmptyState>No balances to show.</EmptyState>
      ) : apple ? (
        <ListSection>
          <div className="grid grid-cols-[1fr_6.5rem_6.5rem] gap-3 px-5 py-2.5 text-xs font-semibold text-slate-500 sm:grid-cols-[1fr_9rem_9rem]">
            <span>Account</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
          </div>
          {tb.rows.map((r) => (
            <div key={r.account.id} className="grid grid-cols-[1fr_6.5rem_6.5rem] items-baseline gap-3 px-5 py-3 text-[15px] sm:grid-cols-[1fr_9rem_9rem]">
              <span className="min-w-0 text-slate-800">
                {r.account.name} <span className="text-xs text-slate-500">{r.account.number}</span>
              </span>
              <span className="text-right tabular-nums text-slate-800">{formatPlain(r.debit, true)}</span>
              <span className="text-right tabular-nums text-slate-800">{formatPlain(r.credit, true)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_6.5rem_6.5rem] gap-3 bg-slate-400/10 px-5 py-3 text-[15px] font-semibold text-slate-900 sm:grid-cols-[1fr_9rem_9rem]">
            <span>Totals</span>
            <span className="text-right tabular-nums">{formatCents(tb.totalDebit)}</span>
            <span className="text-right tabular-nums">{formatCents(tb.totalCredit)}</span>
          </div>
        </ListSection>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="bg-slate-400/10 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-4 py-2 text-right font-medium">Debit</th>
                <th className="px-4 py-2 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400/15">
              {tb.rows.map((r) => (
                <tr key={r.account.id}>
                  <td className="px-4 py-1.5 text-slate-500">{r.account.number}</td>
                  <td className="px-4 py-1.5">{r.account.name}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatPlain(r.debit, true)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{formatPlain(r.credit, true)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-800 font-semibold">
              <tr>
                <td className="px-4 py-2" colSpan={2}>
                  Totals
                </td>
                <td className="px-4 py-2 text-right tabular-nums underline decoration-double">{formatCents(tb.totalDebit)}</td>
                <td className="px-4 py-2 text-right tabular-nums underline decoration-double">{formatCents(tb.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </ReportShell>
  );
}
