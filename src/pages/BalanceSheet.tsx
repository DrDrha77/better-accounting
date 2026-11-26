import { useMemo, useState } from 'react';
import { AppleStatementHeader, ListRow, ListSection, StatTiles, useIsApple } from '../components/apple';
import { fmtDate, formatCents } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { RuledBalanceSheet } from '../components/RuledBalanceSheet';
import { Field, inputClass, StatusBadge } from '../components/ui';
import { centsToCsv, type CsvCell } from '../engine/csv';
import { balanceSheet, classify, type BalanceSheet as BS } from '../engine/reports';
import { useBooks } from '../store/useBooks';
import { useCompanyName } from '../store/useCompanies';

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
  classified = false,
}: {
  bs: BS;
  title: string;
  period: string;
  showNetIncome?: boolean;
  /** Used inside another card (Settings): smaller tiles, no centered header. */
  compact?: boolean;
  /** Group assets into current and fixed, and liabilities into current and long-term. */
  classified?: boolean;
}) {
  const apple = useIsApple();
  const company = useCompanyName();
  const c = classify(bs);
  if (apple && classified) {
    const group = (name: string, items: typeof c.currentAssets, label: string, total: number) =>
      items.length ? (
        <ListSection title={name} inset={compact}>
          {items.map((l) => (
            <ListRow key={l.account.id} label={l.account.name} amount={l.amount} />
          ))}
          <ListRow label={label} amount={total} strong />
        </ListSection>
      ) : null;
    return (
      <div className="space-y-6">
        {!compact && <AppleStatementHeader company={company} title={title} period={period} />}
        <StatTiles compact={compact} tiles={[{ label: 'Total assets', cents: bs.totalAssets }, { label: 'Total liabilities', cents: bs.totalLiabilities }, { label: 'Total equity', cents: bs.totalEquity }]} />
        <div className="flex justify-center">
          <StatusBadge ok={bs.balanced} okText="Assets = Liabilities + Equity ✓" badText={`Out of balance by ${formatCents(Math.abs(bs.difference))}`} />
        </div>
        {group('Current assets', c.currentAssets, 'Total current assets', c.totalCurrentAssets)}
        {group('Fixed assets', c.fixedAssets, 'Total fixed assets', c.totalFixedAssets)}
        <ListSection inset={compact}>
          <ListRow label="Total assets" amount={bs.totalAssets} strong />
        </ListSection>
        {group('Current liabilities', c.currentLiabilities, 'Total current liabilities', c.totalCurrentLiabilities)}
        {group('Long-term liabilities', c.longTermLiabilities, 'Total long-term liabilities', c.totalLongTermLiabilities)}
        <ListSection title="Owner's equity" inset={compact}>
          <ListRow label="Owner’s capital at the end of the period" amount={bs.totalEquity} />
          <ListRow label="Total liabilities and owner's equity" amount={bs.totalLiabilitiesAndEquity} strong />
        </ListSection>
      </div>
    );
  }
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
      <RuledBalanceSheet bs={bs} title={title} period={period} showNetIncome={showNetIncome} classified={classified} />
    </>
  );
}

export function BalanceSheet() {
  const { accounts, entries } = useBooks();
  const [asOf, setAsOf] = useState('');
  const [classified, setClassified] = useState(false);
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
      <div className="mb-4 flex justify-center">
        <div role="radiogroup" aria-label="Balance sheet style" className="field inline-flex gap-1 rounded-full p-1 print:hidden">
          {[
            { v: false, label: 'Regular' },
            { v: true, label: 'Classified' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={classified === o.v}
              onClick={() => setClassified(o.v)}
              className={classified === o.v ? 'seg-active pill-active rounded-full px-4 py-1.5 text-sm font-medium text-white' : 'rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900'}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <BalanceSheetBody bs={bs} title={classified ? 'Classified Balance Sheet' : 'Balance Sheet'} period={period} classified={classified} />
    </ReportShell>
  );
}
