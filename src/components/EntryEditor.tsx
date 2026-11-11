import { useMemo, useState, type ReactNode } from 'react';
import { validateEntry } from '../engine/journal';
import { formatPlain, parseAmount } from '../engine/money';
import type { Account, EntryDraft, JournalLine } from '../engine/types';
import type { ActionResult } from '../store/useBooks';
import { cx, formatCents } from './format';
import { AccountSelect, Button, ErrorList, Field, inputClass } from './ui';

interface EditorLine {
  key: number;
  accountId: string;
  debit: string;
  credit: string;
}

let keySeq = 0;
const toEditorLine = (l?: JournalLine): EditorLine => ({
  key: ++keySeq,
  accountId: l?.accountId ?? '',
  debit: l?.debit ? formatPlain(l.debit) : '',
  credit: l?.credit ? formatPlain(l.credit) : '',
});

export function blankLines(): JournalLine[] {
  return [
    { accountId: '', debit: 0, credit: 0 },
    { accountId: '', debit: 0, credit: 0 },
  ];
}

/**
 * Editable journal entry: date, description, N debit/credit lines with live totals.
 * Used for the parser preview, manual entry and editing existing entries.
 * Save is disabled until the entry validates (debits = credits, etc.).
 */
export function EntryEditor({
  accounts,
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save entry',
  banner,
  extraActions,
}: {
  accounts: Account[];
  initial: { date: string; description: string; lines: JournalLine[]; sourceText?: string };
  onSave: (draft: EntryDraft) => ActionResult;
  onCancel?: () => void;
  saveLabel?: string;
  banner?: ReactNode;
  extraActions?: ReactNode;
}) {
  const [date, setDate] = useState(initial.date);
  const [description, setDescription] = useState(initial.description);
  const [lines, setLines] = useState<EditorLine[]>(() =>
    (initial.lines.length >= 2 ? initial.lines : blankLines()).map(toEditorLine),
  );
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const parsed = useMemo(() => {
    const amountErrors: string[] = [];
    const jl: JournalLine[] = lines.map((l, i) => {
      const d = l.debit.trim() ? parseAmount(l.debit) : 0;
      const c = l.credit.trim() ? parseAmount(l.credit) : 0;
      if (d === null || c === null) amountErrors.push(`Line ${i + 1}: amount isn't a valid number.`);
      return { accountId: l.accountId, debit: d ?? 0, credit: c ?? 0 };
    });
    const draft: EntryDraft = { date, description, lines: jl, sourceText: initial.sourceText };
    const v = validateEntry(draft, accounts);
    const totals = jl.reduce((t, l) => ({ debit: t.debit + l.debit, credit: t.credit + l.credit }), { debit: 0, credit: 0 });
    return { draft, errors: [...amountErrors, ...v.errors], totals };
  }, [lines, date, description, accounts, initial.sourceText]);

  const diff = parsed.totals.debit - parsed.totals.credit;
  const canSave = parsed.errors.length === 0;

  const update = (key: number, patch: Partial<EditorLine>) => {
    setTouched(true);
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const save = () => {
    setTouched(true);
    if (!canSave) return;
    const r = onSave(parsed.draft);
    setServerErrors(r.ok ? [] : r.errors);
  };

  return (
    <div className="space-y-4">
      {banner}
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="Date">
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-1 font-medium">Account</th>
              <th className="w-36 pb-1 text-right font-medium">Debit</th>
              <th className="w-36 pb-1 text-right font-medium">Credit</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.key}>
                <td className={cx('py-1 pr-2', l.credit && !l.debit && 'pl-6')}>
                  <AccountSelect ariaLabel={`Line ${i + 1} account`} accounts={accounts} value={l.accountId} onChange={(id) => update(l.key, { accountId: id })} />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Line ${i + 1} debit`}
                    inputMode="decimal"
                    className={cx(inputClass, 'text-right tabular-nums')}
                    value={l.debit}
                    placeholder="0.00"
                    onChange={(e) => update(l.key, { debit: e.target.value, ...(e.target.value ? { credit: '' } : {}) })}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Line ${i + 1} credit`}
                    inputMode="decimal"
                    className={cx(inputClass, 'text-right tabular-nums')}
                    value={l.credit}
                    placeholder="0.00"
                    onChange={(e) => update(l.key, { credit: e.target.value, ...(e.target.value ? { debit: '' } : {}) })}
                  />
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    aria-label={`Remove line ${i + 1}`}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30"
                    disabled={lines.length <= 2}
                    onClick={() => {
                      setTouched(true);
                      setLines((ls) => ls.filter((x) => x.key !== l.key));
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-medium">
              <td className="pt-2">
                <Button variant="ghost" className="-ml-2" onClick={() => setLines((ls) => [...ls, toEditorLine()])}>
                  + Add line
                </Button>
              </td>
              <td className="pr-4 pt-2 text-right tabular-nums">{formatCents(parsed.totals.debit)}</td>
              <td className="pr-4 pt-2 text-right tabular-nums">{formatCents(parsed.totals.credit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={cx('text-sm font-medium', diff === 0 && parsed.totals.debit > 0 ? 'text-emerald-700' : 'text-amber-700')}>
          {diff === 0
            ? parsed.totals.debit > 0
              ? 'Balanced ✓'
              : 'Enter amounts'
            : `Out of balance by ${formatCents(Math.abs(diff))} (${diff > 0 ? 'debits' : 'credits'} higher)`}
        </span>
        <div className="flex flex-wrap gap-2">
          {extraActions}
          {onCancel && <Button onClick={onCancel}>Cancel</Button>}
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {saveLabel}
          </Button>
        </div>
      </div>
      {touched && <ErrorList errors={[...parsed.errors, ...serverErrors]} />}
    </div>
  );
}
