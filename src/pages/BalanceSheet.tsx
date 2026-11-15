import { useMemo, useState } from 'react';
import { AppleStatementHeader, ListRow, ListSection, StatTiles, useIsApple } from '../components/apple';
import { fmtDate, formatCents } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { Row, Section, StatementCard } from '../components/Statement';
import { Field, inputClass, StatusBadge } from '../components/ui';
import { centsToCsv, type CsvCell } from '../engine/csv';
import { balanceSheet, type BalanceSheet as BS } from '../engine/reports';
import { useBooks } from '../store/useBooks';
import { useSettings } from '../store/useSettings';

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
export function BalanceSheetBody({
  bs,
  title,
  period,
  showNetIncome = true,
  compact = false,
}: {
  bs: BS;
  title: string;
  period: string;
  showNetIncome?: boolean;
  /** Used inside another card (Settings): smaller tiles, no centered header. */
  compact?: boolean;
}) {
  const apple = useIsApple();
  const company = useSettings((s) => s.companyName);
  if (apple) {
    const equityRows = showNetIncome || bs.netIncome !== 0;
    return (
      <div className="space-y-6">
        {!compact && <AppleStatementHeader company={company} title={title} period={period} />}
        <StatTiles
          compact={compact}
          tiles={[
            { label: 'Total assets', cents: bs.totalAssets },
            { label: 'Total liabilities', cents: bs.totalLiabilities },
            { label: "Total equity", cents: bs.totalEquity },
          ]}
        />
        <div className="flex justify-center">
          <StatusBadge ok={bs.balanced} okText="Assets = Liabilities + Equity ✓" badText={`Out of balance by ${formatCents(Math.abs(bs.difference))}`} />
        </div>
        <ListSection title="Assets" inset={compact}>
          {bs.assets.length === 0 && <ListRow label="None" muted />}
          {bs.assets.map((l) => (
            <ListRow key={l.account.id} label={l.account.name} amount={l.amount} />
          ))}
          <ListRow label="Total assets" amount={bs.totalAssets} strong />
        </ListSection>
        <ListSection title="Liabilities" inset={compact}>
          {bs.liabilities.length === 0 && <ListRow label="None" muted />}
          {bs.liabilities.map((l) => (
            <ListRow key={l.account.id} label={l.account.name} amount={l.amount} />
          ))}
          <ListRow label="Total liabilities" amount={bs.totalLiabilities} strong />
        </ListSection>
        <ListSection title="Owner's equity" inset={compact}>
          {bs.equity.map((l) => (
            <ListRow key={l.account.id} label={l.account.name} amount={l.amount} />
          ))}
          {equityRows && <ListRow label="Net income (to date)" amount={bs.netIncome} />}
          <ListRow label="Total equity" amount={bs.totalEquity} strong />
        </ListSection>
        <ListSection inset={compact}>
          <ListRow label="Total liabilities and equity" amount={bs.totalLiabilitiesAndEquity} strong />
        </ListSection>
      </div>
    );
  }
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
