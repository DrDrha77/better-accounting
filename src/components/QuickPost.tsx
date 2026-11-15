import { useEffect, useState } from 'react';
import { todayISO } from '../engine/journal';
import { parseAmount } from '../engine/money';
import { useBooks } from '../store/useBooks';
import { useCompany } from '../store/useCompany';
import { defaultEntryDate } from '../store/useSettings';
import { cx } from './format';
import { AccountSelect, Button, ErrorList, Field, inputClass } from './ui';

/** One debit, one credit, one amount: the fastest way to post a simple entry. */
export function QuickPost() {
  const { accounts, addEntry } = useBooks();
  const entryDate = useCompany((s) => s.entryDate);
  const [date, setDate] = useState(() => defaultEntryDate(entryDate, todayISO()));
  // Follow "Save for date" when it changes.
  useEffect(() => setDate(defaultEntryDate(entryDate, todayISO())), [entryDate]);
  const [amount, setAmount] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const post = () => {
    setSaved(null);
    const cents = amount.trim() ? parseAmount(amount) : null;
    const pre: string[] = [];
    if (cents === null || cents === 0) pre.push('Enter an amount.');
    if (!debit) pre.push('Choose the debit account.');
    if (!credit) pre.push('Choose the credit account.');
    if (debit && debit === credit) pre.push('Debit and credit must be different accounts.');
    if (pre.length) return setErrors(pre);
    const r = addEntry({
      date,
      description,
      lines: [
        { accountId: debit, debit: cents!, credit: 0 },
        { accountId: credit, debit: 0, credit: cents! },
      ],
    });
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setSaved(description.trim());
    setAmount('');
    setDescription('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        post();
      }}
    >
      <div className="text-base font-semibold text-slate-900">Quick post (approved immediately)</div>
      <p className="text-sm text-slate-500">Debits one account, credits another — every statement updates.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_9rem_1fr_1fr]">
        <Field label="Date">
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Amount">
          <input
            aria-label="Quick post amount"
            inputMode="decimal"
            placeholder="0.00"
            className={cx(inputClass, 'text-right tabular-nums')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Debit account">
          <AccountSelect ariaLabel="Quick post debit account" accounts={accounts} value={debit} onChange={setDebit} />
        </Field>
        <Field label="Credit account">
          <AccountSelect ariaLabel="Quick post credit account" accounts={accounts} value={credit} onChange={setCredit} />
        </Field>
      </div>
      <Field label="Description" className="mt-3">
        <input className={inputClass} placeholder="e.g. Paid office rent" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary">
          Post to books
        </Button>
        {saved !== null && <span className="text-sm text-emerald-700">Posted{saved ? ` “${saved}”` : ''}. Every statement is updated.</span>}
      </div>
      <div className="mt-2">
        <ErrorList errors={errors} />
      </div>
    </form>
  );
}
