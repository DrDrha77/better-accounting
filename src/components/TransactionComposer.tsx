import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayISO } from '../engine/journal';
import { PROVIDERS } from '../engine/parser/modelInfo';
import type { ParseResult } from '../engine/parser/types';
import { useBooks } from '../store/useBooks';
import { useCompany } from '../store/useCompany';
import { defaultEntryDate, useSettings } from '../store/useSettings';
import { blankLines, EntryEditor } from './EntryEditor';
import { formatCents } from './format';
import { Button } from './ui';
import { useTransactionParser } from './useTransactionParser';

export const EXAMPLES = [
  'Owner invested 40000 into the business',
  'Bought a car for $4000',
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
  | { kind: 'manual'; text: string; reason?: string; candidates?: string[]; fromAi?: boolean; nonce: number };

/**
 * "Describe a transaction" box: type a sentence, preview the parsed entry, confirm.
 * Falls back to a manual multi-line entry when the sentence can't be recognised.
 * `blankDraftSignal`: change it to open an empty manual entry (the Journal's "Blank draft").
 */
export function TransactionComposer({
  examples = EXAMPLES,
  autoFocus = false,
  blankDraftSignal,
  showManualLink = true,
}: {
  examples?: string[];
  autoFocus?: boolean;
  blankDraftSignal?: number;
  showManualLink?: boolean;
}) {
  const { accounts, addEntry } = useBooks();
  const provider = useSettings((s) => s.aiProvider);
  const entryDate = useCompany((s) => s.entryDate);
  const startDate = defaultEntryDate(entryDate, todayISO());
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { parser, aiEnabled } = useTransactionParser();

  useEffect(() => {
    if (blankDraftSignal) {
      setSaved(null);
      setMode({ kind: 'manual', text: '', nonce: blankDraftSignal });
    }
  }, [blankDraftSignal]);

  const submit = async (input = text) => {
    setSaved(null);
    if (!input.trim() || busy) return;
    setBusy(true);
    setMode({ kind: 'idle' });
    try {
      const result = await parser.parse(input, { accounts, today: startDate });
      if (result.status === 'matched') setMode({ kind: 'preview', result, text: input, nonce: Date.now() });
      else
        setMode({
          kind: 'manual',
          text: input,
          reason: result.reason,
          candidates: result.candidates,
          fromAi: result.source === 'ai',
          nonce: Date.now(),
        });
    } finally {
      setBusy(false);
    }
  };

  const done = (description: string) => {
    setSaved(description);
    setMode({ kind: 'idle' });
    setText('');
  };

  return (
    <div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          aria-label="Describe a transaction"
          className="field flex-1 rounded-full px-5 py-3 text-base text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
          placeholder="Describe a transaction, e.g. “Bought a car for 4000”"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          autoFocus={autoFocus}
        />
        <Button type="submit" variant="primary" className="px-5 py-3 text-base" disabled={busy}>
          {busy ? 'Thinking…' : 'Preview entry'}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {examples.length > 0 && <span className="text-xs text-slate-500">Try:</span>}
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            className="field rounded-full px-3 py-1 text-xs text-slate-600 transition-all duration-300 ease-bubble hover:scale-105 hover:text-cyan-800"
            onClick={() => {
              setText(ex);
              void submit(ex);
            }}
          >
            {ex}
          </button>
        ))}
        {showManualLink && (
          <button
            type="button"
            className="ml-auto text-xs font-medium text-cyan-700 hover:underline"
            onClick={() => {
              setSaved(null);
              setMode({ kind: 'manual', text: '', nonce: Date.now() });
            }}
          >
            Manual journal entry →
          </button>
        )}
      </div>

      {saved && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Saved “{saved}”. All reports are updated. <Link className="underline" to="/journal">View journal</Link>
        </p>
      )}

      {mode.kind === 'preview' && (
        <div className="mt-5 border-t border-slate-400/25 pt-5">
          <EntryEditor
            key={mode.nonce}
            accounts={accounts}
            initial={{ ...mode.result, sourceText: mode.text }}
            banner={
              <div className="space-y-2">
                <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  {mode.result.source === 'ai' ? (
                    <>
                      <span className="mr-1.5 rounded-full bg-violet-400/25 px-2 py-0.5 text-xs font-semibold text-violet-800">AI</span>
                      {PROVIDERS[provider].model} drafted this entry for {formatCents(mode.result.amount)}.
                    </>
                  ) : (
                    <>
                      Recognised as <strong>{mode.result.templateLabel}</strong> for {formatCents(mode.result.amount)}.
                    </>
                  )}{' '}
                  Check the entry below — you can change the date, accounts or amounts before saving.
                </div>
                {mode.result.notes && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <strong>Assumed:</strong> {mode.result.notes}
                  </div>
                )}
              </div>
            }
            saveLabel="Confirm & save"
            onCancel={() => setMode({ kind: 'idle' })}
            extraActions={<Button onClick={() => setMode({ kind: 'manual', text: mode.text, nonce: Date.now() })}>Switch to manual entry</Button>}
            onSave={(d) => {
              const r = addEntry(d);
              if (r.ok) done(d.description);
              return r;
            }}
          />
        </div>
      )}

      {mode.kind === 'manual' && (
        <div className="mt-5 border-t border-slate-400/25 pt-5">
          <EntryEditor
            key={mode.nonce}
            accounts={accounts}
            initial={{ date: startDate, description: mode.text, lines: blankLines(), sourceText: mode.text || undefined }}
            banner={
              mode.reason ? (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <strong>Couldn't create this entry automatically.</strong> {mode.reason}
                  {mode.candidates && <> Possible matches: {mode.candidates.join(', ')}.</>} Enter the debits and credits below.
                  {!aiEnabled && !mode.fromAi && (
                    <div className="mt-1 text-xs">
                      Tip: add a Gemini or Claude API key in{' '}
                      <Link to="/settings" className="underline">
                        Settings
                      </Link>{' '}
                      and AI will handle sentences like this.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm font-medium text-slate-700">Blank journal entry: add as many debit and credit lines as you need.</div>
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
    </div>
  );
}
