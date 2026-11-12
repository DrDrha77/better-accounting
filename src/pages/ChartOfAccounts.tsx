import { useMemo, useState } from 'react';
import { cx, formatCents } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { Button, Card, ErrorList, Field, inputClass } from '../components/ui';
import { ACCOUNT_TYPES, normalSide, sortAccounts, suggestAccountNumber, TYPE_LABELS, TYPE_RANGES } from '../engine/accounts';
import { accountHasActivity, ledgerFor } from '../engine/ledger';
import type { Account, AccountType } from '../engine/types';
import { useBooks } from '../store/useBooks';

export function ChartOfAccounts() {
  const { accounts, entries, addAccount, renameAccount, deleteAccount } = useBooks();
  const [type, setType] = useState<AccountType>('expense');
  const [number, setNumber] = useState(() => String(suggestAccountNumber(accounts, 'expense')));
  const [name, setName] = useState('');
  const [contra, setContra] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);

  const balances = useMemo(() => new Map(accounts.map((a) => [a.id, ledgerFor(a, entries).balance])), [accounts, entries]);

  const submit = () => {
    const r = addAccount({ type, number: Number(number), name, contra });
    if (r.ok) {
      setName('');
      setContra(false);
      setErrors([]);
      setNumber(String(suggestAccountNumber(useBooks.getState().accounts, type)));
    } else setErrors(r.errors);
  };

  const csvRows = () => [
    ['Number', 'Name', 'Type', 'Normal balance', 'Contra', 'Balance'],
    ...sortAccounts(accounts).map((a) => [a.number, a.name, TYPE_LABELS[a.type], normalSide(a), a.contra ? 'yes' : '', (balances.get(a.id) ?? 0) / 100]),
  ];

  return (
    <ReportShell title="Chart of Accounts" subtitle="1000s assets · 2000s liabilities · 3000s equity · 4000s revenue · 5000s expenses" csvName="chart-of-accounts.csv" csvRows={csvRows}>
      <Card className="mb-5 p-5 print:hidden">
        <h2 className="mb-3 font-medium text-slate-900">Add an account</h2>
        <form
          className="grid gap-3 sm:grid-cols-[9rem_7rem_1fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Type">
            <select
              className={inputClass}
              value={type}
              onChange={(e) => {
                const t = e.target.value as AccountType;
                setType(t);
                setNumber(String(suggestAccountNumber(accounts, t)));
              }}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Number (${TYPE_RANGES[type][0]}–${TYPE_RANGES[type][1]})`}>
            <input className={inputClass} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Advertising Expense" />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600" title="Contra accounts carry the opposite balance of their type, e.g. Accumulated Depreciation.">
            <input type="checkbox" checked={contra} onChange={(e) => setContra(e.target.checked)} /> Contra
          </label>
          <Button type="submit" variant="primary">
            Add account
          </Button>
        </form>
        <div className="mt-3">
          <ErrorList errors={errors} />
        </div>
      </Card>

      <ErrorList errors={rowErrors} />

      <div className="mt-3 space-y-5">
        {ACCOUNT_TYPES.map((t) => {
          const list = sortAccounts(accounts.filter((a) => a.type === t));
          return (
            <Card key={t} className="overflow-x-auto break-inside-avoid">
              <div className="border-b border-slate-400/25 px-4 py-2.5 font-medium text-slate-900">{TYPE_LABELS[t]}s</div>
              <table className="w-full min-w-[32rem] text-sm">
                <tbody className="divide-y divide-slate-400/15">
                  {list.map((a) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      balance={balances.get(a.id) ?? 0}
                      used={accountHasActivity(a.id, entries)}
                      editing={editing?.id === a.id ? editing.name : null}
                      onEdit={(v) => setEditing(v === null ? null : { id: a.id, name: v })}
                      onSave={() => {
                        if (!editing) return;
                        const r = renameAccount(a.id, editing.name);
                        setRowErrors(r.ok ? [] : r.errors);
                        if (r.ok) setEditing(null);
                      }}
                      onDelete={() => {
                        if (!window.confirm(`Delete account “${a.name}”?`)) return;
                        const r = deleteAccount(a.id);
                        setRowErrors(r.ok ? [] : r.errors);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </ReportShell>
  );
}

function AccountRow({ account: a, balance, used, editing, onEdit, onSave, onDelete }: {
  account: Account;
  balance: number;
  used: boolean;
  editing: string | null;
  onEdit: (v: string | null) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <tr>
      <td className="w-20 px-4 py-2 text-slate-500">{a.number}</td>
      <td className="px-4 py-2">
        {editing !== null ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <input aria-label="Account name" className={inputClass} value={editing} autoFocus onChange={(e) => onEdit(e.target.value)} />
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button onClick={() => onEdit(null)}>Cancel</Button>
          </form>
        ) : (
          <>
            {a.name}
            {a.contra && <span className="ml-2 rounded bg-slate-400/15 px-1.5 py-0.5 text-xs text-slate-500">contra</span>}
          </>
        )}
      </td>
      <td className="w-24 px-4 py-2 text-xs capitalize text-slate-500">{normalSide(a)}</td>
      <td className={cx('w-32 px-4 py-2 text-right tabular-nums', !used && 'text-slate-400')}>{formatCents(balance)}</td>
      <td className="w-36 whitespace-nowrap px-4 py-2 text-right print:hidden">
        {editing === null && (
          <>
            <button type="button" className="text-xs text-cyan-700 hover:underline" onClick={() => onEdit(a.name)}>
              Rename
            </button>
            <button
              type="button"
              className="ml-3 text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
              disabled={used}
              title={used ? "Accounts with transactions can't be deleted" : ''}
              onClick={onDelete}
            >
              Delete
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
