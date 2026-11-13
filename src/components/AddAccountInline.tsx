import { useState } from 'react';
import { suggestAccountNumber, TYPE_LABELS, TYPE_RANGES } from '../engine/accounts';
import type { Account, AccountType } from '../engine/types';
import { useBooks } from '../store/useBooks';
import { cx } from './format';
import { Button, ErrorList, inputClass } from './ui';

/** Common accounts people look for that aren't in the default chart. */
export const ACCOUNT_SUGGESTIONS: Record<AccountType, { name: string; contra?: boolean }[]> = {
  asset: [{ name: 'Savings Account' }, { name: 'Inventory' }, { name: 'Land' }, { name: 'Buildings' }, { name: 'Accumulated Depreciation', contra: true }],
  liability: [{ name: 'Mortgage Payable' }, { name: 'Bank Loan Payable' }, { name: 'Credit Card Payable' }, { name: 'Sales Tax Payable' }, { name: 'Interest Payable' }],
  equity: [{ name: 'Partner Capital' }],
  revenue: [{ name: 'Sales Revenue' }, { name: 'Interest Income' }, { name: 'Rental Income' }],
  expense: [{ name: 'Software & Subscriptions' }, { name: 'Office Expense' }, { name: 'Depreciation Expense' }, { name: 'Bank Fees' }],
};

/**
 * "+ Add account" for one account type. Collapsed it's a single button; open, it's a small
 * form with one-tap suggestions. Calls onAdded with the new account so the caller can focus it.
 */
export function AddAccountInline({ type, onAdded }: { type: AccountType; onAdded?: (account: Account) => void }) {
  const accounts = useBooks((s) => s.accounts);
  const addAccount = useBooks((s) => s.addAccount);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [contra, setContra] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const label = TYPE_LABELS[type].toLowerCase();
  const [lo, hi] = TYPE_RANGES[type];
  const taken = new Set(accounts.map((a) => a.name.toLowerCase()));
  const suggestions = ACCOUNT_SUGGESTIONS[type].filter((s) => !taken.has(s.name.toLowerCase()));

  const start = () => {
    setOpen(true);
    setName('');
    setContra(false);
    setErrors([]);
    setNumber(String(suggestAccountNumber(accounts, type)));
  };

  const submit = (nameToAdd = name, contraToAdd = contra) => {
    const r = addAccount({ type, number: Number(number), name: nameToAdd, contra: contraToAdd });
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    const created = useBooks.getState().accounts.find((a) => a.id === r.id);
    setOpen(false);
    if (created) onAdded?.(created);
  };

  if (!open)
    return (
      <Button variant="ghost" className="-ml-2 text-cyan-700" onClick={start}>
        + Add {label} account
      </Button>
    );

  return (
    <div className="field pop-in space-y-3 rounded-2xl p-3">
      <div className="text-sm font-semibold text-slate-800">New {label} account</div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Quick add:</span>
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              className="field rounded-full px-3 py-1 text-xs text-slate-700 transition-all duration-300 ease-bubble hover:scale-105 hover:text-cyan-800"
              onClick={() => submit(s.name, !!s.contra)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <form
        className="grid gap-2 sm:grid-cols-[1fr_7rem_auto_auto_auto] sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          aria-label={`New ${label} account name`}
          className={inputClass}
          placeholder={`Account name, e.g. ${ACCOUNT_SUGGESTIONS[type][0]?.name ?? 'My account'}`}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <input
          aria-label={`New ${label} account number (${lo}–${hi})`}
          title={`${lo}–${hi}`}
          className={cx(inputClass, 'tabular-nums')}
          inputMode="numeric"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-600" title="Contra accounts carry the opposite balance of their type, e.g. Accumulated Depreciation.">
          <input type="checkbox" className="accent-cyan-500" checked={contra} onChange={(e) => setContra(e.target.checked)} /> Contra
        </label>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Add
        </Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </form>
      <ErrorList errors={errors} />
    </div>
  );
}
