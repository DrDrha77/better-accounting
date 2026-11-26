import { useMemo, useState } from 'react';
import { AppleStatementHeader, ListRow, ListSection, StatTiles, useIsApple } from '../components/apple';
import { cx, fmtDate, formatCents } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { Card, Field, inputClass } from '../components/ui';
import { centsToCsv } from '../engine/csv';
import { ownersEquityStatement } from '../engine/reports';
import { useBooks } from '../store/useBooks';
import { useCompanyName } from '../store/useCompanies';

const money = (c: number) => (c < 0 ? `(${formatCents(-c)})` : formatCents(c));

interface Row {
  label: string;
  col?: 1 | 2;
  amount?: number;
  kind?: 'item' | 'total';
  indent?: boolean;
}

/** Statement of Owner's Equity: how the owner's capital changed over the period. */
export function OwnersEquity() {
  const { accounts, entries } = useBooks();
  const company = useCompanyName();
  const apple = useIsApple();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const s = useMemo(() => ownersEquityStatement(accounts, entries, from || undefined, to || undefined), [accounts, entries, from, to]);

  const capitals = accounts.filter((a) => a.type === 'equity' && !a.contra && a.systemKey !== 'opening_balance_equity');
  const owner = capitals.length === 1 ? capitals[0].name : "Owner's capital";
  const period = from || to ? `${from ? `From ${fmtDate(from)}` : ''}${from && to ? ' ' : ''}${to ? `to ${fmtDate(to)}` : ''}`.trim() : 'All dates';
  const loss = s.netIncome < 0;
  const change = s.investments + s.netIncome - s.drawings;

  const rows: Row[] = [{ label: `${owner}${from ? `, ${fmtDate(from)}` : ', beginning'}`, col: 2, amount: s.beginningEquity }];
  if (s.investments) rows.push({ label: 'Add: Additional investments', col: 1, amount: s.investments, indent: true });
  if (s.netIncome || !s.drawings) rows.push({ label: loss ? 'Less: Net loss' : 'Add: Net income', col: 1, amount: Math.abs(s.netIncome), indent: true });
  if (s.drawings) rows.push({ label: `Less: ${capitals.length === 1 ? capitals[0].name.replace(/,?\s*capital$/i, '') + ', ' : ''}Drawings`, col: 1, amount: s.drawings, indent: true });
  rows.push({ label: change < 0 ? 'Decrease in capital' : 'Increase in capital', col: 2, amount: change });
  rows.push({ label: `${owner}${to ? `, ${fmtDate(to)}` : ', end'}`, col: 2, amount: s.endingEquity, kind: 'total' });

  const csvRows = () => [
    ["Statement of Owner's Equity", period],
    ['', 'Amount', 'Total'],
    ...rows.map((r) => [r.label, r.col === 1 ? centsToCsv(r.amount ?? 0) : '', r.col === 2 ? centsToCsv(r.amount ?? 0) : '']),
  ];

  return (
    <ReportShell
      title="Statement of Owner's Equity"
      subtitle="How the owner's capital changed: beginning capital, plus net income, less drawings."
      csvName="owners-equity.csv"
      csvRows={csvRows}
      filters={
        <>
          <Field label="From (optional)">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To (optional)">
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </>
      }
    >
      {apple ? (
        <div className="space-y-6">
          <AppleStatementHeader company={company} title="Statement of Owner's Equity" period={period} />
          <StatTiles tiles={[{ label: 'Beginning capital', cents: s.beginningEquity }, { label: loss ? 'Net loss' : 'Net income', cents: s.netIncome, tone: loss ? 'negative' : 'positive' }, { label: 'Ending capital', cents: s.endingEquity }]} />
          <ListSection>
            {rows.map((r, i) => (
              <ListRow key={i} label={r.label} amount={r.amount} strong={r.kind === 'total'} />
            ))}
          </ListSection>
        </div>
      ) : (
        <Card className="mx-auto max-w-3xl overflow-hidden px-4 py-6 sm:px-6">
          <div className="mb-4 text-center">
            {company && <div className="serif text-xl font-bold text-slate-900">{company}</div>}
            <div className="text-lg font-semibold text-slate-900">Statement of Owner's Equity</div>
            <div className="text-sm text-slate-500">{period}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse border-2 border-slate-900/70 text-sm" aria-label="Statement of owner's equity">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-400/50">
                    <td className={cx('px-3 py-1.5 text-slate-900', r.indent && 'pl-7', r.kind === 'total' && 'font-semibold')}>{r.label}</td>
                    {([1, 2] as const).map((c) => (
                      <td key={c} className={cx('w-32 border-l border-slate-900/50 px-2 py-1.5 text-right tabular-nums text-slate-900', c === 2 && 'border-l-2', r.col === c && r.kind === 'total' && 'font-semibold')}>
                        {r.col === c && r.amount !== undefined && (
                          <span className={cx(r.kind === 'total' && 'border-b-4 border-double border-slate-800 pb-0.5', c === 1 && r.label.startsWith('Less') && 'border-b border-slate-700 pb-0.5')}>{money(r.amount)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </ReportShell>
  );
}
