import { useMemo, useState } from 'react';
import { fmtDate, formatCents } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { Row, Section, StatementCard } from '../components/Statement';
import { Field, inputClass, StatusBadge } from '../components/ui';
import { centsToCsv, type CsvCell } from '../engine/csv';
import { balanceSheet, type BalanceSheet as BS } from '../engine/reports';
import { useBooks } from '../store/useBooks';

export function balanceSheetCsv(bs: BS, heading: string): CsvCell[][] {
  return [
    [heading, bs.asOf ? `As of ${bs.asOf}` : 'All dates'],
    ['Section', 'Account', 'Amount'],
    ...bs.assets.map((l) => ['Assets', l.account.name, centsToCsv(l.amount)]),
    ['Assets', 'Total assets', centsToCsv(bs.totalAssets)],
    ...bs.liabilities.map((l) => ['Liabilities', l.account.name, centsToCsv(l.amount)]),
    ['Liabilities', 'Total liabilities', centsToCsv(bs.totalLiabilities)],
    ...bs.equity.map((l) => ['Equity', l.account.name, centsToCsv(l.amount)]),
    ['Equity', 'Net income (to date)', centsToCsv(bs.netIncome)],
    ['Equity', 'Total equity', centsToCsv(bs.totalEquity)],
    ['', 'Total liabilities and equity', centsToCsv(bs.totalLiabilitiesAndEquity)],
  ];
}

/** The statement body, shared by the Balance Sheet and Opening Statement pages. */
export function BalanceSheetBody({ bs, title, period, showNetIncome = true }: { bs: BS; title: string; period: string; showNetIncome?: boolean }) {
  return (
    <>
      <div className="mb-4 flex justify-center">
        <StatusBadge
          ok={bs.balanced}
          okText="Assets = Liabilities + Equity ✓"
          badText={`Out of balance by ${formatCents(Math.abs(bs.difference))}`}
        />
      </div>
      <StatementCard title={title} period={period}>
        <Section title="Assets" lines={bs.assets} totalLabel="Total assets" total={bs.totalAssets} />
        <Section title="Liabilities" lines={bs.liabilities} totalLabel="Total liabilities" total={bs.totalLiabilities} />
        <Section
          title="Owner's equity"
          lines={bs.equity}
          totalLabel="Total equity"
          total={bs.totalEquity}
          extra={showNetIncome || bs.netIncome !== 0 ? <Row label="Net income (to date)" amount={bs.netIncome} indent /> : undefined}
        />
        <Row label="Total liabilities and equity" amount={bs.totalLiabilitiesAndEquity} bold doubleRule />
      </StatementCard>
    </>
  );
}

export function BalanceSheet() {
  const { accounts, entries } = useBooks();
  const [asOf, setAsOf] = useState('');
  const bs = useMemo(() => balanceSheet(accounts, entries, asOf || undefined), [accounts, entries, asOf]);
  const period = asOf ? `As of ${fmtDate(asOf)}` : 'As of the latest entry';

  return (
    <ReportShell
      title="Balance Sheet"
      subtitle="Equity includes capital, less drawings, plus net income to date (no closing entries needed)."
      csvName="balance-sheet.csv"
      csvRows={() => balanceSheetCsv(bs, 'Balance Sheet')}
      filters={
        <Field label="As of">
          <input type="date" className={inputClass} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
      }
    >
      <BalanceSheetBody bs={bs} title="Balance Sheet" period={period} />
    </ReportShell>
  );
}
