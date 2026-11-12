import { useMemo, useState } from 'react';
import { AddAccountInline } from '../components/AddAccountInline';
import { Link } from 'react-router-dom';
import { cx, fmtDate, formatCents, formatPlain } from '../components/format';
import { Button, Card, ErrorList, Field, inputClass, PageHeader } from '../components/ui';
import { ACCOUNT_TYPES, findBySystemKey, normalSide, sortAccounts, SYSTEM_KEYS, TYPE_LABELS } from '../engine/accounts';
import { todayISO } from '../engine/journal';
import { parseAmount } from '../engine/money';
import { entryToOpeningInput, openingTotals, plugToOpeningBalanceEquity, type OpeningBalanceInput } from '../engine/opening';
import type { Account, Side } from '../engine/types';
import { useBooks } from '../store/useBooks';

interface Row {
  amount: string;
  side: Side;
}

function initialRows(accounts: Account[], input?: OpeningBalanceInput): Record<string, Row> {
  const rows: Record<string, Row> = {};
  for (const a of accounts) rows[a.id] = { amount: '', side: normalSide(a) };
  for (const l of input?.lines ?? []) rows[l.accountId] = { amount: formatPlain(l.amount), side: l.side };
  return rows;
}

/** Plain-language hints for accounting jargon. */
const HINTS: Record<string, string> = {
  [SYSTEM_KEYS.notesPayable]: 'bank loans and other borrowed money',
  [SYSTEM_KEYS.openingBalanceEquity]: 'balancing figure; see the button below',
};

export function OpeningBalances() {
  const { accounts, entries, saveOpening, removeOpening } = useBooks();
  const existing = entries.find((e) => e.kind === 'opening');
  const existingInput = existing ? entryToOpeningInput(existing) : undefined;

  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [rows, setRows] = useState<Record<string, Row>>(() => initialRows(accounts, existingInput));
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const { input, badAmounts } = useMemo(() => {
    const bad: string[] = [];
    const lines = accounts.flatMap((a) => {
      const r = rows[a.id] ?? { amount: '', side: normalSide(a) };
      if (!r.amount.trim()) return [];
      const cents = parseAmount(r.amount);
      if (cents === null) {
        bad.push(`${a.name}: “${r.amount}” isn't a valid amount.`);
        return [];
      }
      return cents ? [{ accountId: a.id, side: r.side, amount: cents }] : [];
    });
    return { input: { date, lines } as OpeningBalanceInput, badAmounts: bad };
  }, [accounts, rows, date]);

  const totals = openingTotals(input);
  const balanced = totals.difference === 0 && totals.debit > 0 && badAmounts.length === 0;
  const earlier = entries.filter((e) => e.kind !== 'opening' && e.date < date);

  const setRow = (id: string, patch: Partial<Row>) => {
    setMessage(null);
    setRows((rs) => {
      const acct = accounts.find((a) => a.id === id);
      const base = rs[id] ?? { amount: '', side: acct ? normalSide(acct) : 'debit' };
      return { ...rs, [id]: { ...base, ...patch } };
    });
  };

  /** Only the Opening Balance Equity row changes; every other row keeps exactly what the user typed. */
  const plug = () => {
    if (badAmounts.length) return;
    const obe = findBySystemKey(accounts, SYSTEM_KEYS.openingBalanceEquity);
    if (!obe) return;
    const line = plugToOpeningBalanceEquity(input, accounts).lines.find((l) => l.accountId === obe.id);
    setRow(obe.id, line ? { amount: formatPlain(line.amount), side: line.side } : { amount: '', side: normalSide(obe) });
  };

  const save = () => {
    const r = saveOpening(input);
    if (r.ok) {
      setErrors([]);
      setMessage('Opening balances saved and posted as the first journal entry.');
    } else setErrors(r.errors);
  };

  return (
    <div>
      <PageHeader
        title="Opening Balances"
        subtitle="Enter each account's starting balance. They're posted as a single “Opening Balance” journal entry dated before everything else."
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Field label="Balances as of">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {existing && (
            <p className="text-sm text-slate-500">
              Currently posted as of {fmtDate(existing.date)}.{' '}
              <Link to="/opening-statement" className="text-cyan-700 hover:underline">
                View opening statement
              </Link>
            </p>
          )}
        </div>
        {earlier.length > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {earlier.length} existing {earlier.length === 1 ? 'entry is' : 'entries are'} dated before {fmtDate(date)}. Opening balances usually come
            before all other transactions.
          </p>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 font-medium">Account</th>
                <th className="w-28 py-2 font-medium">Side</th>
                <th className="w-40 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            {ACCOUNT_TYPES.map((t) => {
              const list = sortAccounts(accounts.filter((a) => a.type === t));
              return (
                <tbody key={t}>
                  <tr>
                    <td colSpan={3} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {TYPE_LABELS[t]}
                    </td>
                  </tr>
                  {list.map((a) => {
                    const r = rows[a.id] ?? { amount: '', side: normalSide(a) };
                    return (
                      <tr key={a.id} className="border-t border-slate-400/15">
                        <td className="py-1 pr-2">
                          <span className="mr-2 text-slate-400">{a.number}</span>
                          {a.name}
                          {a.systemKey && HINTS[a.systemKey] && <span className="block pl-[2.6rem] text-xs text-slate-500">{HINTS[a.systemKey]}</span>}
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            aria-label={`${a.name} side`}
                            className={cx(inputClass, r.side !== normalSide(a) && 'border-amber-400')}
                            value={r.side}
                            onChange={(e) => setRow(a.id, { side: e.target.value as Side })}
                          >
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>
                        </td>
                        <td className="py-1">
                          <input
                            aria-label={`${a.name} opening amount`}
                            data-account-amount={a.id}
                            inputMode="decimal"
                            placeholder="0.00"
                            className={cx(inputClass, 'text-right tabular-nums')}
                            value={r.amount}
                            onChange={(e) => setRow(a.id, { amount: e.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={3} className="pb-2 pt-1">
                      <AddAccountInline
                        type={t}
                        onAdded={(acct) =>
                          // Wait a tick for the new row to render, then jump to its amount box.
                          setTimeout(() => document.querySelector<HTMLInputElement>(`[data-account-amount="${acct.id}"]`)?.focus(), 50)
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>

        <div className="glass-strong sticky bottom-3 -mx-2 mt-4 rounded-[1.5rem] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>
              Debits <strong className="tabular-nums">{formatCents(totals.debit)}</strong>
            </span>
            <span>
              Credits <strong className="tabular-nums">{formatCents(totals.credit)}</strong>
            </span>
            <span className={cx('font-medium', totals.difference === 0 ? 'text-cyan-700' : 'text-red-700')}>
              {totals.difference === 0
                ? 'Balanced ✓'
                : `Difference ${formatCents(Math.abs(totals.difference))} (${totals.difference > 0 ? 'debits' : 'credits'} higher)`}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {existing && (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm('Remove the opening balance entry?')) {
                      removeOpening();
                      setRows(initialRows(accounts));
                      setMessage('Opening balance entry removed.');
                    }
                  }}
                >
                  Remove
                </Button>
              )}
              {totals.difference !== 0 && (
                <Button onClick={plug} disabled={badAmounts.length > 0} title={badAmounts.length ? 'Fix the invalid amounts first' : ''}>
                  Post difference to Opening Balance Equity
                </Button>
              )}
              <Button variant="primary" disabled={!balanced} onClick={save} title={balanced ? '' : 'Debits must equal credits'}>
                {existing ? 'Update opening balances' : 'Save opening balances'}
              </Button>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <ErrorList errors={[...badAmounts, ...errors]} />
            {message && <p className="text-sm text-cyan-700">{message}</p>}
          </div>
        </div>
      </Card>
    </div>
  );
}
