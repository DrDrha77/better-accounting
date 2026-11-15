import { useMemo, useState } from 'react';
import { AppleStatementHeader, ListRow, ListSection, StatTiles, useIsApple } from '../components/apple';
import { fmtDate } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { Row, Section, StatementCard } from '../components/Statement';
import { Field, inputClass } from '../components/ui';
import { centsToCsv } from '../engine/csv';
import { incomeStatement } from '../engine/reports';
import { useBooks } from '../store/useBooks';
import { useSettings } from '../store/useSettings';

export function periodLabel(from: string, to: string): string {
  if (from && to) return `For the period ${fmtDate(from)} – ${fmtDate(to)}`;
  if (from) return `From ${fmtDate(from)}`;
  if (to) return `Through ${fmtDate(to)}`;
  return 'All dates';
}

export function IncomeStatement() {
  const { accounts, entries } = useBooks();
  const periodFrom = useSettings((s) => s.periodFrom);
  const [from, setFrom] = useState(periodFrom);
  const [to, setTo] = useState('');
  const is = useMemo(() => incomeStatement(accounts, entries, from || undefined, to || undefined), [accounts, entries, from, to]);
  const period = periodLabel(from, to);
  const apple = useIsApple();
  const company = useSettings((s) => s.companyName);

  const csvRows = () => [
    ['Income Statement', period],
    ['Section', 'Account', 'Amount'],
    ...is.revenues.map((l) => ['Revenue', l.account.name, centsToCsv(l.amount)]),
    ['Revenue', 'Total revenue', centsToCsv(is.totalRevenue)],
    ...is.expenses.map((l) => ['Expenses', l.account.name, centsToCsv(l.amount)]),
    ['Expenses', 'Total expenses', centsToCsv(is.totalExpenses)],
    ['', is.netIncome >= 0 ? 'Net income' : 'Net loss', centsToCsv(is.netIncome)],
  ];

  return (
    <ReportShell
      title="Income Statement"
      subtitle="Revenues less expenses for a period."
      csvName="income-statement.csv"
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
      {apple ? (
        <div className="space-y-6">
          <AppleStatementHeader company={company} title="Income Statement" period={period} />
          <StatTiles
            tiles={[
              { label: 'Revenue', cents: is.totalRevenue },
              { label: 'Expenses', cents: is.totalExpenses },
              { label: is.netIncome >= 0 ? 'Net income' : 'Net loss', cents: is.netIncome, tone: is.netIncome >= 0 ? 'positive' : 'negative' },
            ]}
          />
          <ListSection title="Revenue">
            {is.revenues.length === 0 && <ListRow label="None" muted />}
            {is.revenues.map((l) => (
              <ListRow key={l.account.id} label={l.account.name} amount={l.amount} />
            ))}
            <ListRow label="Total revenue" amount={is.totalRevenue} strong />
          </ListSection>
          <ListSection title="Expenses">
            {is.expenses.length === 0 && <ListRow label="None" muted />}
            {is.expenses.map((l) => (
              <ListRow key={l.account.id} label={l.account.name} amount={l.amount} />
            ))}
            <ListRow label="Total expenses" amount={is.totalExpenses} strong />
          </ListSection>
          <ListSection>
            <ListRow label={is.netIncome >= 0 ? 'Net income' : 'Net loss'} amount={is.netIncome} strong />
          </ListSection>
        </div>
      ) : (
        <StatementCard title="Income Statement" period={period}>
          <Section title="Revenue" lines={is.revenues} totalLabel="Total revenue" total={is.totalRevenue} />
          <Section title="Expenses" lines={is.expenses} totalLabel="Total expenses" total={is.totalExpenses} />
          <Row label={is.netIncome >= 0 ? 'Net income' : 'Net loss'} amount={is.netIncome} bold doubleRule />
        </StatementCard>
      )}
    </ReportShell>
  );
}
