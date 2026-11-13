import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ACCOUNT_TYPES, sortAccounts, TYPE_LABELS } from '../engine/accounts';
import type { Account } from '../engine/types';
import { cx } from './format';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

/** Pill-shaped "bubble" buttons with a springy press. */
export function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'pill-active text-white hover:brightness-110 disabled:opacity-45 disabled:saturate-50',
    secondary: 'field text-slate-800 hover:bg-slate-500/5 disabled:text-slate-400',
    danger: 'field border-red-300 text-red-700 hover:bg-red-500/10 disabled:opacity-40',
    ghost: 'text-slate-600 hover:bg-slate-500/10 disabled:text-slate-300',
  };
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200',
        'active:scale-[0.97] disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card pop-in rounded-2xl print:rounded-none', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl text-slate-900 sm:text-4xl">{title}</h1>
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
        'inline-flex items-center rounded-full px-3.5 py-1 text-sm font-semibold backdrop-blur',
        ok ? 'bg-emerald-400/20 text-emerald-700 ring-1 ring-emerald-400/50' : 'bg-red-400/20 text-red-700 ring-1 ring-red-400/50',
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
  'field w-full rounded-xl px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-cyan-400/60 [&>optgroup]:bg-slate-50 [&>option]:bg-slate-50';

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
                {a.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="field rounded-2xl border-dashed p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul className="space-y-0.5 rounded-2xl bg-red-400/15 px-4 py-2 text-sm text-red-700 ring-1 ring-red-400/30">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
