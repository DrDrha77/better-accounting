import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ACCOUNT_TYPES, accountLabel, sortAccounts, TYPE_LABELS } from '../engine/accounts';
import type { Account } from '../engine/types';
import { cx } from './format';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50 disabled:text-red-300',
    ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  };
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-lg border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        ok ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200',
      )}
    >
      {ok ? okText : badText}
    </span>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block text-sm', className)}>
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

export function AccountSelect({
  accounts,
  value,
  onChange,
  className,
  allowEmpty = true,
  ariaLabel,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  allowEmpty?: boolean;
  ariaLabel?: string;
}) {
  const sorted = sortAccounts(accounts);
  return (
    <select aria-label={ariaLabel} className={cx(inputClass, className)} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">Choose account…</option>}
      {ACCOUNT_TYPES.map((t) => (
        <optgroup key={t} label={TYPE_LABELS[t]}>
          {sorted
            .filter((a) => a.type === t)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {accountLabel(a)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul className="space-y-0.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
