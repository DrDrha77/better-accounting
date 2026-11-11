import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { blankLines, EntryEditor } from '../components/EntryEditor';
import { fmtDate, formatCents } from '../components/format';
import { Button, Card, StatusBadge } from '../components/ui';
import { findBySystemKey, SYSTEM_KEYS } from '../engine/accounts';
import { entryNumberLabel, todayISO } from '../engine/journal';
import { ledgerFor } from '../engine/ledger';
import { RuleBasedParser } from '../engine/parser/ruleParser';
import type { ParseResult, TransactionParser } from '../engine/parser/types';
import { balanceSheet, trialBalance } from '../engine/reports';
import { useBooks } from '../store/useBooks';

/** Swap this for an LLM-backed implementation of TransactionParser later. */
const parser: TransactionParser = new RuleBasedParser();

const EXAMPLES = [
  'Owner invested 40000 into the business',
  'Bought equipment for 5000 cash',
  'Bought supplies on credit for 800',
  'Earned 3000 service revenue in cash',
  'Paid rent 1200',
  'Paid wages 2000',
  'Owner withdrew 500',
  'Collected 1000 from customer',
  'Paid 400 on account',
  'Borrowed 10000 from the bank',
];

type Mode =
  | { kind: 'idle' }
  | { kind: 'preview'; result: Extract<ParseResult, { status: 'matched' }>; text: string; nonce: number }
  | { kind: 'manual'; text: string; reason?: string; candidates?: string[]; nonce: number };

export function Dashboard() {
  const { accounts, entries, addEntry, loadSample } = useBooks();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [saved, setSaved] = useState<string | null>(null);

  const stats = useMemo(() => {
    const cash = findBySystemKey(accounts, SYSTEM_KEYS.cash);
    const bs = balanceSheet(accounts, entries);
    const tb = trialBalance(accounts, entries);
    return { cash: cash ? ledgerFor(cash, entries).balance : 0, bs, tb };
  }, [accounts, entries]);

  const recent = useMemo(() => [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6), [entries]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const submit = async (input = text) => {
    setSaved(null);
    if (!input.trim()) return;
    const result = await parser.parse(input, { accounts, today: todayISO() });
    if (result.status === 'matched') setMode({ kind: 'preview', result, text: input, nonce: Date.now() });
    else setMode({ kind: 'manual', text: input, reason: result.reason, candidates: result.candidates, nonce: Date.now() });
  };

  const done = (description: string) => {
    setSaved(description);
    setMode({ kind: 'idle' });
    setText('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Add a transaction</h1>
        <p className="mt-1 text-sm text-slate-500">Describe what happened in plain English. You'll confirm the journal entry before anything is saved.</p>
      </div>

      <Card className="p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            aria-label="Describe a transaction"
            className="flex-1 rounded-md border border-slate-300 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            placeholder="Describe a transaction, e.g. “Paid rent 1200”"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <Button type="submit" variant="primary" className="px-5 py-3 text-base">
            Preview entry
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={() => {
                setText(ex);
                void submit(ex);
              }}
            >
              {ex}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto text-xs font-medium text-emerald-700 hover:underline"
            onClick={() => {
              setSaved(null);
              setMode({ kind: 'manual', text: '', nonce: Date.now() });
            }}
          >
            Manual journal entry →
          </button>
        </div>

        {saved && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Saved “{saved}”. All reports are updated. <Link className="underline" to="/journal">View journal</Link>
          </p>
        )}

        {mode.kind === 'preview' && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <EntryEditor
              key={mode.nonce}
              accounts={accounts}
              initial={{ ...mode.result, sourceText: mode.text }}
              banner={
                <div className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  Recognised as <strong>{mode.result.templateLabel}</strong> for {formatCents(mode.result.amount)}. Check the entry below — you can change
                  the date, accounts or amounts before saving.
                </div>
              }
              saveLabel="Confirm & save"
              onCancel={() => setMode({ kind: 'idle' })}
              extraActions={
                <Button onClick={() => setMode({ kind: 'manual', text: mode.text, nonce: Date.now() })}>Switch to manual entry</Button>
              }
              onSave={(d) => {
                const r = addEntry(d);
                if (r.ok) done(d.description);
                return r;
              }}
            />
          </div>
        )}

        {mode.kind === 'manual' && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <EntryEditor
              key={mode.nonce}
              accounts={accounts}
              initial={{ date: todayISO(), description: mode.text, lines: blankLines(), sourceText: mode.text || undefined }}
              banner={
                mode.reason ? (
                  <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <strong>Couldn't create this entry automatically.</strong> {mode.reason}
                    {mode.candidates && <> Possible matches: {mode.candidates.join(', ')}.</>} Enter the debits and credits below.
                  </div>
                ) : (
                  <div className="text-sm font-medium text-slate-700">Manual journal entry</div>
                )
              }
              onCancel={() => setMode({ kind: 'idle' })}
              onSave={(d) => {
                const r = addEntry(d);
                if (r.ok) done(d.description);
                return r;
              }}
            />
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cash" value={formatCents(stats.cash)} />
        <Stat label="Total assets" value={formatCents(stats.bs.totalAssets)} />
        <Stat label="Net income (to date)" value={formatCents(stats.bs.netIncome)} />
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Trial balance</div>
          <div className="mt-2">
            <StatusBadge ok={stats.tb.balanced} okText="Balanced ✓" badText={`Off by ${formatCents(Math.abs(stats.tb.difference))}`} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-medium text-slate-900">Recent entries</h2>
          <Link to="/journal" className="text-sm text-emerald-700 hover:underline">
            All entries →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No entries yet. Type a transaction above, enter <Link className="text-emerald-700 underline" to="/opening-balances">opening balances</Link>, or{' '}
            <button type="button" className="text-emerald-700 underline" onClick={loadSample}>
              load sample data
            </button>
            .
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-10 font-mono text-xs text-slate-400">{entryNumberLabel(e)}</span>
                <span className="w-24 text-slate-500">{fmtDate(e.date)}</span>
                <span className="min-w-0 flex-1 font-medium text-slate-800">{e.description}</span>
                <span className="text-slate-500">
                  {e.lines
                    .map((l) => `${l.debit ? 'Dr' : 'Cr'} ${byId.get(l.accountId)?.name ?? '?'}`)
                    .join(' · ')}
                </span>
                <span className="w-28 text-right tabular-nums text-slate-900">{formatCents(e.lines.reduce((s, l) => s + l.debit, 0))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
    </Card>
  );
}
