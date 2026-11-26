import { classify, type BalanceSheet } from '../engine/reports';
import { useCompanyName } from '../store/useCompanies';
import { cx, formatCents } from './format';
import { Card } from './ui';

type Kind = 'heading' | 'item' | 'subtotal' | 'total';
interface Line {
  label: string;
  kind: Kind;
  indent?: boolean;
  /** Number column: 1 = adjustments (net income or loss, drawings), 2 = the accounts, 3 = totals. */
  col?: 1 | 2 | 3;
  amount?: number;
}

const money = (c: number) => (c < 0 ? `(${formatCents(-c)})` : formatCents(c));

/** The rows laid out like the paper worksheet: adjustments in column 1, account balances in column 2, totals in column 3. */
export function ruledLines(bs: BalanceSheet, showNetIncome: boolean): Line[] {
  const lines: Line[] = [];
  lines.push({ label: 'Assets', kind: 'heading' });
  if (!bs.assets.length) lines.push({ label: 'None', kind: 'item', indent: true });
  bs.assets.forEach((l) => lines.push({ label: l.account.name, kind: 'item', indent: true, col: 2, amount: l.amount }));
  lines.push({ label: 'Total assets', kind: 'total', col: 3, amount: bs.totalAssets });

  lines.push({ label: 'Liabilities', kind: 'heading' });
  if (!bs.liabilities.length) lines.push({ label: 'None', kind: 'item', indent: true });
  bs.liabilities.forEach((l) => lines.push({ label: l.account.name, kind: 'item', indent: true, col: 2, amount: l.amount }));
  lines.push({ label: 'Total liabilities', kind: 'subtotal', col: 3, amount: bs.totalLiabilities });

  lines.push({ label: "Owner's equity", kind: 'heading' });
  const capital = bs.equity.filter((l) => !l.account.contra);
  const drawings = bs.equity.filter((l) => l.account.contra);
  const showIncome = showNetIncome || bs.netIncome !== 0;
  capital.forEach((l) => lines.push({ label: l.account.name, kind: 'item', indent: true, col: 2, amount: l.amount }));
  if (showIncome) lines.push({ label: bs.netIncome < 0 ? 'Net loss' : 'Net income', kind: 'item', indent: true, col: 1, amount: bs.netIncome });
  drawings.forEach((l) => lines.push({ label: l.account.name, kind: 'item', indent: true, col: 1, amount: l.amount }));
  const change = (showIncome ? bs.netIncome : 0) + drawings.reduce((s, l) => s + l.amount, 0);
  if (showIncome || drawings.length) {
    lines.push({ label: change < 0 ? 'Decrease in capital' : 'Increase in capital', kind: 'subtotal', col: 2, amount: change });
  }
  if (capital.length !== 1 || showIncome || drawings.length) lines.push({ label: "Total owner's equity", kind: 'subtotal', col: 3, amount: bs.totalEquity });
  lines.push({ label: "Total liabilities and owner's equity", kind: 'total', col: 3, amount: bs.totalLiabilitiesAndEquity });
  return lines;
}

/** Classified layout: current and fixed assets, current and long-term liabilities, with subtotals in the last column. */
export function classifiedLines(bs: BalanceSheet): Line[] {
  const c = classify(bs);
  const lines: Line[] = [];
  const group = (title: string, items: typeof c.currentAssets, totalLabel: string, total: number) => {
    if (!items.length) return;
    lines.push({ label: title, kind: 'heading' });
    items.forEach((l) => lines.push({ label: l.account.name, kind: 'item', indent: true, col: 2, amount: l.amount }));
    lines.push({ label: totalLabel, kind: 'subtotal', col: 3, amount: total });
  };
  lines.push({ label: 'Assets', kind: 'heading' });
  if (!bs.assets.length) lines.push({ label: 'None', kind: 'item', indent: true });
  group('Current assets', c.currentAssets, 'Total current assets', c.totalCurrentAssets);
  group('Fixed assets', c.fixedAssets, 'Total fixed assets', c.totalFixedAssets);
  lines.push({ label: 'Total assets', kind: 'total', col: 3, amount: bs.totalAssets });

  lines.push({ label: "Liabilities and owner's equity", kind: 'heading' });
  group('Current liabilities', c.currentLiabilities, 'Total current liabilities', c.totalCurrentLiabilities);
  group('Long-term liabilities', c.longTermLiabilities, 'Total long-term liabilities', c.totalLongTermLiabilities);
  lines.push({ label: 'Total liabilities', kind: 'subtotal', col: 3, amount: bs.totalLiabilities });
  lines.push({ label: "Owner's equity", kind: 'heading' });
  lines.push({ label: 'Owner’s capital at the end of the period', kind: 'item', indent: true, col: 3, amount: bs.totalEquity });
  lines.push({ label: "Total liabilities and owner's equity", kind: 'total', col: 3, amount: bs.totalLiabilitiesAndEquity });
  return lines;
}

/** Classic-design balance sheet on ruled paper: a name column and three number columns. */
export function RuledBalanceSheet({ bs, title, period, showNetIncome = true, classified = false }: { bs: BalanceSheet; title: string; period: string; showNetIncome?: boolean; classified?: boolean }) {
  const company = useCompanyName();
  const lines = classified ? classifiedLines(bs) : ruledLines(bs, showNetIncome);
  return (
    <Card className="mx-auto max-w-3xl overflow-hidden px-4 py-6 sm:px-6">
      <div className="mb-4 text-center">
        {company && <div className="serif text-xl font-bold text-slate-900">{company}</div>}
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="text-sm text-slate-500">{period}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse border-2 border-slate-900/70 text-sm" aria-label={title}>
          <thead className="sr-only">
            <tr>
              <th>Account</th>
              <th>Adjustment</th>
              <th>Balance</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className={cx('border-b border-slate-400/50', l.kind === 'heading' && 'bg-slate-400/10')}>
                <td className={cx('px-3 py-1.5 text-slate-900', l.indent && 'pl-7', (l.kind === 'heading' || l.kind === 'total') && 'font-semibold', l.kind === 'heading' && 'underline decoration-slate-500 underline-offset-4')}>
                  {l.label}
                </td>
                {([1, 2, 3] as const).map((c) => (
                  <td
                    key={c}
                    className={cx(
                      'w-28 border-l border-slate-900/50 px-2 py-1.5 text-right tabular-nums text-slate-900 sm:w-32',
                      c === 3 && 'border-l-2',
                      l.col === c && l.kind === 'subtotal' && 'border-t border-t-slate-700',
                      l.col === c && l.kind === 'total' && 'border-t border-t-slate-700 font-semibold',
                    )}
                  >
                    {l.col === c && l.amount !== undefined && (
                      <span className={cx(l.kind === 'total' && 'border-b-4 border-double border-slate-800 pb-0.5', l.kind === 'subtotal' && 'font-medium')}>{money(l.amount)}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
