import { useMemo, useState } from 'react';
import { formatCents, formatPlain } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { AccountSelect, EmptyState, Field, inputClass } from '../components/ui';
import { sortAccounts } from '../engine/accounts';
import { centsToCsv } from '../engine/csv';
import { tAccount, type TAccount, type TItem } from '../engine/ledger';
import { useBooks } from '../store/useBooks';

export function TAccounts() {
  const { accounts, entries } = useBooks();
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');

  const ts = useMemo(() => {
    const list = accountId ? accounts.filter((a) => a.id === accountId) : sortAccounts(accounts);
    return list.map((a) => tAccount(a, entries, { to: to || undefined })).filter((t) => accountId || t.debits.length + t.credits.length > 0);
  }, [accounts, entries, accountId, to]);

  const csvRows = () => [
    ['Account #', 'Account', 'Side', 'Entry', 'Date', 'Amount'],
    ...ts.flatMap((t) => [
      ...t.debits.map((d) => [t.account.number, t.account.name, 'Debit', d.entryLabel, d.date, centsToCsv(d.amount)]),
      ...t.credits.map((c) => [t.account.number, t.account.name, 'Credit', c.entryLabel, c.date, centsToCsv(c.amount)]),
      [t.account.number, t.account.name, `Ending balance (${t.balanceSide})`, '', '', centsToCsv(t.balance)],
    ]),
  ];

  return (
    <ReportShell
      title="T-Accounts"
      subtitle="Debits on the left, credits on the right."
      csvName="t-accounts.csv"
      csvRows={csvRows}
      filters={
        <>
          <Field label="Account" className="w-72">
            <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
          </Field>
          {accountId && (
            <button type="button" className="pb-2 text-sm text-cyan-700 hover:underline" onClick={() => setAccountId('')}>
              Show all
            </button>
          )}
          <Field label="As of (optional)">
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </>
      }
    >
      {ts.length === 0 ? (
        <EmptyState>No postings yet.</EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ts.map((t) => (
            <TChart key={t.account.id} t={t} />
          ))}
        </div>
      )}
    </ReportShell>
  );
}

function Side({ items }: { items: TItem[] }) {
  return (
    <ul className="min-h-[3rem] space-y-0.5 py-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex justify-between gap-2 px-2 text-sm" title={it.description}>
          <span className="font-mono text-xs text-slate-400">{it.entryLabel}</span>
          <span className="tabular-nums">{formatPlain(it.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function TChart({ t }: { t: TAccount }) {
  return (
    <div className="glass pop-in break-inside-avoid rounded-[1.75rem] p-5">
      <div className="border-b-2 border-slate-800 pb-1 text-center font-medium text-slate-900">
        {t.account.name}
        <span className="ml-1 text-xs font-normal text-slate-400">#{t.account.number}</span>
      </div>
      <div className="grid grid-cols-2">
        <div className="border-r-2 border-slate-800">
          <div className="px-2 pt-1 text-xs uppercase tracking-wide text-slate-400">Debit</div>
          <Side items={t.debits} />
        </div>
        <div>
          <div className="px-2 pt-1 text-right text-xs uppercase tracking-wide text-slate-400">Credit</div>
          <Side items={t.credits} />
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-slate-400/40 text-sm font-medium">
        <div className="border-r-2 border-slate-800 px-2 py-1 text-right tabular-nums">{formatPlain(t.totalDebit)}</div>
        <div className="px-2 py-1 text-right tabular-nums">{formatPlain(t.totalCredit)}</div>
      </div>
      <div className={`mt-1 text-sm ${t.balanceSide === 'debit' ? 'text-left' : 'text-right'}`}>
        <span className="rounded bg-slate-400/15 px-2 py-0.5 font-semibold tabular-nums">
          Bal. {formatCents(t.balance)} {t.balanceSide === 'debit' ? 'Dr' : 'Cr'}
        </span>
      </div>
    </div>
  );
}
