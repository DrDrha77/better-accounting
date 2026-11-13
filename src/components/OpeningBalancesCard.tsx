import { forwardRef, useMemo, useState } from 'react';
import { ACCOUNT_TYPES, findBySystemKey, normalSide, sortAccounts, SYSTEM_KEYS } from '../engine/accounts';
import { todayISO } from '../engine/journal';
import { parseAmount } from '../engine/money';
import { OPENING_DESCRIPTION, plugToOpeningBalanceEquity, type OpeningBalanceInput, type OpeningBalanceLine } from '../engine/opening';
import type { Account, AccountType, Cents } from '../engine/types';
import { useBooks } from '../store/useBooks';
import { useSettings } from '../store/useSettings';
import { cx, fmtDate, formatCents, formatPlain } from './format';
import { Button, Card, ErrorList, Field, inputClass } from './ui';

const SECTION_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: "Owner's equity",
  revenue: 'Revenue',
  expense: 'Expenses',
};

/**
 * Parse an amount typed on an account's normal side. A leading minus (or brackets) means the
 * balance is on the other side, e.g. an overdrawn bank account. Returns signed cents or null.
 */
export function parseSignedAmount(text: string): Cents | null {
  const t = text.trim();
  if (!t) return 0;
  const negative = /^-|^\(.*\)$/.test(t);
  const cents = parseAmount(t.replace(/^-\s*/, '').replace(/^\((.*)\)$/, '$1'));
  return cents === null ? null : negative ? -cents : cents;
}

/** Signed cents (normal side positive) → opening line on the right side. */
function toLine(account: Account, signed: Cents): OpeningBalanceLine | null {
  if (!signed) return null;
  const side = normalSide(account);
  const flip = signed < 0;
  return { accountId: account.id, side: flip ? (side === 'debit' ? 'credit' : 'debit') : side, amount: Math.abs(signed) };
}

/**
 * Opening balances in one card: one amount per account on its normal side. The difference is
 * posted to Opening Balance Equity automatically, so the opening entry always balances.
 */
export const OpeningBalancesCard = forwardRef<HTMLDivElement>(function OpeningBalancesCard(_props, ref) {
  const { accounts, entries, saveOpening, removeOpening, clearJournal } = useBooks();
  const setPeriodFrom = useSettings((s) => s.setPeriodFrom);
  const existing = entries.find((e) => e.kind === 'opening');
  const obe = findBySystemKey(accounts, SYSTEM_KEYS.openingBalanceEquity);

  const initialAmounts = () => {
    const out: Record<string, string> = {};
    for (const l of existing?.lines ?? []) {
      const a = accounts.find((x) => x.id === l.accountId);
      if (!a || a.id === obe?.id) continue;
      const net = l.debit - l.credit;
      out[a.id] = formatPlain(normalSide(a) === 'debit' ? net : -net);
    }
    return out;
  };

  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [memo, setMemo] = useState(existing?.description ?? 'Opening balances');
  const [setPeriod, setSetPeriod] = useState(true);
  const [clearFirst, setClearFirst] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>(initialAmounts);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const { input, bad, plug } = useMemo(() => {
    const badAmounts: string[] = [];
    const lines: OpeningBalanceLine[] = [];
    for (const a of accounts) {
      if (a.id === obe?.id) continue;
      const signed = parseSignedAmount(amounts[a.id] ?? '');
      if (signed === null) badAmounts.push(`${a.name}: “${amounts[a.id]}” isn't a valid amount.`);
      else {
        const line = toLine(a, signed);
        if (line) lines.push(line);
      }
    }
    const base: OpeningBalanceInput = { date, lines, description: memo };
    const balanced = obe ? plugToOpeningBalanceEquity(base, accounts) : base;
    const obeLine = balanced.lines.find((l) => l.accountId === obe?.id);
    // Show the plug on Opening Balance Equity's normal (credit) side.
    const plugAmount = obeLine ? (obeLine.side === 'credit' ? obeLine.amount : -obeLine.amount) : 0;
    return { input: balanced, bad: badAmounts, plug: plugAmount };
  }, [accounts, amounts, date, memo, obe]);

  const postedCount = entries.filter((e) => e.kind !== 'opening').length;

  const save = () => {
    setMessage(null);
    if (bad.length) return setErrors(bad);
    if (!input.lines.length) return setErrors(['Enter at least one opening balance.']);
    if (clearFirst && postedCount) {
      if (!window.confirm(`Clear journal first: delete all ${postedCount} journal ${postedCount === 1 ? 'entry' : 'entries'}? Accounts are kept. This can't be undone.`))
        return;
      clearJournal();
    }
    const r = saveOpening(input);
    if (!r.ok) return setErrors(r.errors);
    if (setPeriod) setPeriodFrom(date);
    setErrors([]);
    setClearFirst(false);
    setMessage(
      `Saved as of ${fmtDate(date)}.` +
        (plug ? ` ${formatCents(Math.abs(plug))} went to Opening Balance Equity to balance it.` : '') +
        (setPeriod ? ' The reporting period now starts on this date.' : ''),
    );
  };

  const remove = () => {
    if (!window.confirm('Remove the opening balance entry?')) return;
    removeOpening();
    setAmounts({});
    setMessage('Opening balances removed.');
  };

  return (
    <Card className="p-5 sm:p-6">
      <div ref={ref} id="opening-balances" className="scroll-mt-24" />
      <h2 className="serif text-lg font-bold text-slate-900">Opening balances</h2>
      <p className="mt-1 text-sm text-slate-600">
        Starting amounts on the normal side; the difference plugs to Opening Balance Equity (e.g. Cash 1,500.00). Use a minus sign for a balance on the
        other side.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[11rem_1fr]">
        <Field label="As-of">
          <input type="date" className={cx(inputClass, 'py-2 text-base')} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Memo">
          <input className={cx(inputClass, 'py-2 text-base')} placeholder={OPENING_DESCRIPTION} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 space-y-1.5 text-sm text-slate-800">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-cyan-700" checked={setPeriod} onChange={(e) => setSetPeriod(e.target.checked)} />
          Set period From to this date
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-cyan-700" checked={clearFirst} onChange={(e) => setClearFirst(e.target.checked)} />
          Clear journal first
        </label>
      </div>

      <div className="mt-4">
        {ACCOUNT_TYPES.map((t) => {
          const list = sortAccounts(accounts.filter((a) => a.type === t));
          if (!list.length) return null;
          return (
            <div key={t} className="mt-3">
              <div className="serif mb-1 text-xs font-bold uppercase tracking-wider text-slate-700">{SECTION_LABELS[t]}</div>
              {list.map((a) =>
                a.id === obe?.id ? (
                  <div key={a.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="text-slate-900">
                      {a.name} <span className="text-xs text-slate-500">(fills in automatically)</span>
                    </span>
                    <span aria-label="Opening Balance Equity amount" className="w-32 shrink-0 pr-3 text-right tabular-nums text-slate-700 sm:w-40">
                      {formatPlain(plug)}
                    </span>
                  </div>
                ) : (
                  <label key={a.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                    <span className="min-w-0 flex-1 text-slate-900">{a.name}</span>
                    <span className="w-32 shrink-0 sm:w-40">
                      <input
                        aria-label={`${a.name} opening amount`}
                        inputMode="decimal"
                        placeholder="0"
                        className={cx(inputClass, 'py-1.5 text-right tabular-nums')}
                        value={amounts[a.id] ?? ''}
                        onChange={(e) => {
                          setMessage(null);
                          setAmounts((m) => ({ ...m, [a.id]: e.target.value }));
                        }}
                      />
                    </span>
                  </label>
                ),
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-400/25 pt-4">
        <Button variant="primary" className="px-6 py-2" onClick={save}>
          {existing ? 'Update opening balances' : 'Save opening balances'}
        </Button>
        {existing && (
          <Button variant="danger" onClick={remove}>
            Remove opening entry
          </Button>
        )}
        <span className="text-sm text-slate-600">
          Debits {formatCents(input.lines.filter((l) => l.side === 'debit').reduce((s, l) => s + l.amount, 0))} · Credits{' '}
          {formatCents(input.lines.filter((l) => l.side === 'credit').reduce((s, l) => s + l.amount, 0))} · Balanced ✓
        </span>
      </div>
      <div className="mt-2 space-y-2">
        <ErrorList errors={errors} />
        {message && <p className="text-sm text-cyan-700">{message}</p>}
      </div>
    </Card>
  );
});
