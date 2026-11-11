import type { ReactNode } from 'react';
import type { StatementLine } from '../engine/reports';
import { cx, formatCents } from './format';
import { Card } from './ui';

/** Building blocks for financial statements (income statement, balance sheet…). */
export function StatementCard({ title, period, children }: { title: string; period: string; children: ReactNode }) {
  return (
    <Card className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-5 text-center">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="text-sm text-slate-500">{period}</div>
      </div>
      <div className="space-y-5 text-sm">{children}</div>
    </Card>
  );
}

export function Section({ title, lines, totalLabel, total, extra, empty = 'None' }: {
  title: string;
  lines: StatementLine[];
  totalLabel: string;
  total: number;
  extra?: ReactNode;
  empty?: string;
}) {
  return (
    <div>
      <div className="mb-1 font-semibold text-slate-900">{title}</div>
      {lines.length === 0 && !extra && <Row label={empty} muted />}
      {lines.map((l) => (
        <Row key={l.account.id} label={l.account.name} amount={l.amount} indent />
      ))}
      {extra}
      <Row label={totalLabel} amount={total} bold topRule />
    </div>
  );
}

export function Row({ label, amount, indent, bold, topRule, doubleRule, muted }: {
  label: ReactNode;
  amount?: number;
  indent?: boolean;
  bold?: boolean;
  topRule?: boolean;
  doubleRule?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cx('flex justify-between py-0.5', bold && 'font-semibold', muted && 'text-slate-400', indent && 'pl-4')}>
      <span>{label}</span>
      {amount !== undefined && (
        <span className={cx('tabular-nums', topRule && 'border-t border-slate-400 pt-0.5', doubleRule && 'border-b-4 border-double border-slate-800')}>
          {amount < 0 ? `(${formatCents(-amount)})` : formatCents(amount)}
        </span>
      )}
    </div>
  );
}
