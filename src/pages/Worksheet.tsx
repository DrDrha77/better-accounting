import { useMemo, useState } from 'react';
import { cx, fmtDate, formatCents } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { Card, EmptyState, Field, inputClass, StatusBadge } from '../components/ui';
import { centsToCsv } from '../engine/csv';
import { worksheet } from '../engine/worksheet';
import { useBooks } from '../store/useBooks';
import { useCompanyName } from '../store/useCompanies';

const cell = (c: number) => (c ? formatCents(c) : '');

/** The 6-column accountant's work sheet: trial balance, income statement and balance sheet side by side. */
export function Worksheet() {
  const { accounts, entries } = useBooks();
  const company = useCompanyName();
  const [asOf, setAsOf] = useState('');
  const ws = useMemo(() => worksheet(accounts, entries, asOf || undefined), [accounts, entries, asOf]);
  const period = asOf ? `As of ${fmtDate(asOf)}` : 'All dates';
  const loss = ws.netIncome < 0;

  const csvRows = () => [
    ['Work Sheet', period],
    ['Acc. no.', 'Account', 'TB Debit', 'TB Credit', 'IS Debit', 'IS Credit', 'BS Debit', 'BS Credit'],
    ...ws.rows.map((r) => [r.account.number, r.account.name, centsToCsv(r.tbDebit, true), centsToCsv(r.tbCredit, true), centsToCsv(r.isDebit, true), centsToCsv(r.isCredit, true), centsToCsv(r.bsDebit, true), centsToCsv(r.bsCredit, true)]),
    ['', 'Totals', centsToCsv(ws.subtotal.tbDebit), centsToCsv(ws.subtotal.tbCredit), centsToCsv(ws.subtotal.isDebit), centsToCsv(ws.subtotal.isCredit), centsToCsv(ws.subtotal.bsDebit), centsToCsv(ws.subtotal.bsCredit)],
    ['', loss ? 'Net loss' : 'Net income', '', '', centsToCsv(loss ? 0 : ws.netIncome, true), centsToCsv(loss ? -ws.netIncome : 0, true), centsToCsv(loss ? -ws.netIncome : 0, true), centsToCsv(loss ? 0 : ws.netIncome, true)],
    ['', 'Totals', '', '', centsToCsv(ws.total.isDebit), centsToCsv(ws.total.isCredit), centsToCsv(ws.total.bsDebit), centsToCsv(ws.total.bsCredit)],
  ];

  const num = 'w-24 px-2 py-1.5 text-right tabular-nums sm:w-28';
  const edge = 'border-l border-slate-900/50';
  return (
    <ReportShell
      title="Work Sheet"
      subtitle="The trial balance carried across to the income statement and balance sheet, with net income as the balancing figure."
      csvName="work-sheet.csv"
      csvRows={csvRows}
      filters={
        <Field label="As of (optional)">
          <input type="date" className={inputClass} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
      }
    >
      {ws.rows.length === 0 ? (
        <EmptyState>Nothing to show yet. Post a transaction or set opening balances and the work sheet fills itself in.</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex justify-center">
            <StatusBadge ok={ws.balanced} okText="Every column pair balances ✓" badText="Out of balance" />
          </div>
          <Card className="overflow-hidden p-4 sm:p-5">
            <div className="mb-3 text-center">
              {company && <div className="serif text-xl font-bold text-slate-900">{company}</div>}
              <div className="text-lg font-semibold text-slate-900">Work Sheet</div>
              <div className="text-sm text-slate-500">{period}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] border-collapse border-2 border-slate-900/70 text-sm" aria-label="Work sheet">
                <thead className="bg-slate-400/10 text-slate-900">
                  <tr className="border-b border-slate-900/50">
                    <th rowSpan={2} className="w-14 px-2 py-1.5 text-left font-semibold">Acc. no.</th>
                    <th rowSpan={2} className={cx(edge, 'px-3 py-1.5 text-left font-semibold')}>Account title</th>
                    <th colSpan={2} className={cx(edge, 'px-2 py-1.5 text-center font-semibold')}>Trial balance</th>
                    <th colSpan={2} className={cx(edge, 'px-2 py-1.5 text-center font-semibold')}>Income statement</th>
                    <th colSpan={2} className={cx(edge, 'px-2 py-1.5 text-center font-semibold')}>Balance sheet</th>
                  </tr>
                  <tr className="border-b-2 border-slate-900/70">
                    {['Debit', 'Credit', 'Debit', 'Credit', 'Debit', 'Credit'].map((h, i) => (
                      <th key={i} className={cx(edge, 'px-2 py-1 text-center font-medium', i % 2 === 0 && 'border-l-2')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ws.rows.map((r) => (
                    <tr key={r.account.id} className="border-b border-slate-400/50 text-slate-900">
                      <td className="px-2 py-1.5 text-slate-500">{r.account.number}</td>
                      <td className={cx(edge, 'px-3 py-1.5')}>{r.account.name}</td>
                      {[r.tbDebit, r.tbCredit, r.isDebit, r.isCredit, r.bsDebit, r.bsCredit].map((v, i) => (
                        <td key={i} className={cx(edge, num, i % 2 === 0 && 'border-l-2')}>{cell(v)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-b border-slate-400/50 font-semibold text-slate-900">
                    <td />
                    <td className={cx(edge, 'px-3 py-1.5')}>Totals</td>
                    {[ws.subtotal.tbDebit, ws.subtotal.tbCredit, ws.subtotal.isDebit, ws.subtotal.isCredit, ws.subtotal.bsDebit, ws.subtotal.bsCredit].map((v, i) => (
                      <td key={i} className={cx(edge, num, i % 2 === 0 && 'border-l-2', 'border-t border-t-slate-700')}>{cell(v)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-400/50 text-slate-900">
                    <td />
                    <td className={cx(edge, 'px-3 py-1.5 font-semibold')}>{loss ? 'Net loss' : 'Net income'}</td>
                    <td className={cx(edge, num, 'border-l-2')} />
                    <td className={cx(edge, num)} />
                    <td className={cx(edge, num, 'border-l-2')}>{cell(loss ? 0 : ws.netIncome)}</td>
                    <td className={cx(edge, num)}>{cell(loss ? -ws.netIncome : 0)}</td>
                    <td className={cx(edge, num, 'border-l-2')}>{cell(loss ? -ws.netIncome : 0)}</td>
                    <td className={cx(edge, num)}>{cell(loss ? 0 : ws.netIncome)}</td>
                  </tr>
                  <tr className="font-semibold text-slate-900">
                    <td />
                    <td className={cx(edge, 'px-3 py-1.5')}>Totals</td>
                    <td className={cx(edge, num, 'border-l-2')} />
                    <td className={cx(edge, num)} />
                    {[ws.total.isDebit, ws.total.isCredit, ws.total.bsDebit, ws.total.bsCredit].map((v, i) => (
                      <td key={i} className={cx(edge, num, i % 2 === 0 && 'border-l-2')}>
                        <span className="border-b-4 border-double border-slate-800 pb-0.5">{cell(v)}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </ReportShell>
  );
}
