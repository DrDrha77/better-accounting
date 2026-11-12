import { useMemo, useState } from 'react';
import { fmtDate, formatCents, formatPlain } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { AccountSelect, Card, EmptyState, Field, inputClass } from '../components/ui';
import { normalSide, sortAccounts } from '../engine/accounts';
import { centsToCsv } from '../engine/csv';
import { ledgerFor, type Ledger as LedgerT } from '../engine/ledger';
import { useBooks } from '../store/useBooks';

export function Ledger() {
  const { accounts, entries } = useBooks();
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');

  const ledgers = useMemo(() => {
    const list = accountId ? accounts.filter((a) => a.id === accountId) : sortAccounts(accounts);
    return list.map((a) => ledgerFor(a, entries, { to: to || undefined })).filter((l) => accountId || l.rows.length > 0);
  }, [accounts, entries, accountId, to]);

  const csvRows = () => [
    ['Account #', 'Account', 'Entry', 'Date', 'Description', 'Debit', 'Credit', 'Balance'],
    ...ledgers.flatMap((l) =>
      l.rows.map((r) => [l.account.number, l.account.name, r.entryLabel, r.date, r.description, centsToCsv(r.debit, true), centsToCsv(r.credit, true), centsToCsv(r.balance)]),
    ),
  ];

  return (
    <ReportShell
      title="General Ledger"
      subtitle="Each account's postings with a running balance on its normal side."
      csvName="general-ledger.csv"
      csvRows={csvRows}
      filters={
        <>
          <Field label="Account" className="w-72">
            <select className={inputClass} value={accountId ? 'one' : 'all'} onChange={(e) => setAccountId(e.target.value === 'all' ? '' : accounts[0]?.id ?? '')}>
              <option value="all">All accounts (grouped)</option>
              <option value="one">A single account…</option>
            </select>
          </Field>
          {accountId && (
            <Field label="Which account" className="w-72">
              <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} allowEmpty={false} />
            </Field>
          )}
          <Field label="As of (optional)">
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </>
      }
    >
      {ledgers.length === 0 ? (
        <EmptyState>No postings yet.</EmptyState>
      ) : (
        <div className="space-y-5">
          {ledgers.map((l) => (
            <LedgerTable key={l.account.id} ledger={l} />
          ))}
        </div>
      )}
    </ReportShell>
  );
}

function LedgerTable({ ledger }: { ledger: LedgerT }) {
  const side = normalSide(ledger.account);
  return (
    <Card className="overflow-x-auto break-inside-avoid">
      <div className="flex items-baseline justify-between border-b border-slate-400/25 px-4 py-2.5">
        <h2 className="font-medium text-slate-900">
          {ledger.account.number} · {ledger.account.name}
        </h2>
        <span className="text-xs text-slate-500">Normal balance: {side}</span>
      </div>
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">#</th>
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-4 py-2 text-right font-medium">Debit</th>
            <th className="px-4 py-2 text-right font-medium">Credit</th>
            <th className="px-4 py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400/15">
          {ledger.rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-3 text-center text-slate-400">
                No postings.
              </td>
            </tr>
          )}
          {ledger.rows.map((r, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap px-4 py-1.5 text-slate-600">{fmtDate(r.date)}</td>
              <td className="px-4 py-1.5 font-mono text-xs text-slate-400">{r.entryLabel}</td>
              <td className="px-4 py-1.5">{r.description}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatPlain(r.debit, true)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{formatPlain(r.credit, true)}</td>
              <td className="px-4 py-1.5 text-right font-medium tabular-nums">{formatPlain(r.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-400/40 font-medium">
          <tr>
            <td className="px-4 py-2" colSpan={3}>
              Totals / ending balance
            </td>
            <td className="px-4 py-2 text-right tabular-nums">{formatPlain(ledger.totalDebit)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatPlain(ledger.totalCredit)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatCents(ledger.balance)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
