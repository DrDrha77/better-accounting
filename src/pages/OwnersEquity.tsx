import { useMemo, useState } from 'react';
import { ReportShell } from '../components/ReportShell';
import { Row, StatementCard } from '../components/Statement';
import { Field, inputClass } from '../components/ui';
import { centsToCsv } from '../engine/csv';
import { ownersEquityStatement } from '../engine/reports';
import { useBooks } from '../store/useBooks';
import { periodLabel } from './IncomeStatement';

export function OwnersEquity() {
  const { accounts, entries } = useBooks();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const s = useMemo(() => ownersEquityStatement(accounts, entries, from || undefined, to || undefined), [accounts, entries, from, to]);
  const period = periodLabel(from, to);

  const csvRows = () => [
    ["Statement of Owner's Equity", period],
    ['Beginning equity', centsToCsv(s.beginningEquity)],
    ['Owner investments', centsToCsv(s.investments)],
    [s.netIncome >= 0 ? 'Net income' : 'Net loss', centsToCsv(s.netIncome)],
    ['Owner drawings', centsToCsv(-s.drawings)],
    ['Ending equity', centsToCsv(s.endingEquity)],
  ];

  return (
    <ReportShell
      title="Owner's Equity"
      subtitle="How owner's equity changed over the period. The ending figure ties to the balance sheet."
      csvName="owners-equity.csv"
      csvRows={csvRows}
      filters={
        <>
          <Field label="From">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </>
      }
    >
      <StatementCard title="Statement of Owner's Equity" period={period}>
        <div>
          <Row label="Beginning equity (incl. opening balances)" amount={s.beginningEquity} />
          <Row label="Add: owner investments" amount={s.investments} indent />
          <Row label={s.netIncome >= 0 ? 'Add: net income' : 'Less: net loss'} amount={s.netIncome} indent />
          <Row label="Less: owner drawings" amount={-s.drawings} indent />
          <Row label="Ending equity" amount={s.endingEquity} bold topRule doubleRule />
        </div>
      </StatementCard>
    </ReportShell>
  );
}
