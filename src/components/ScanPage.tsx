import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TYPE_LABELS } from '../engine/accounts';
import { todayISO } from '../engine/journal';
import { PROVIDERS } from '../engine/parser/modelInfo';
import type { ScanImage, ScanOutcome } from '../engine/parser/types';
import { applyScan, planScan, type ScanPlan } from '../engine/scan';
import { renameCompany, undoable } from '../store/companyActions';
import { useBooks } from '../store/useBooks';
import { useCompany } from '../store/useCompany';
import { isPlaceholderName, useCompanies, useCompanyName } from '../store/useCompanies';
import { useSettings } from '../store/useSettings';
import { cx, fmtDate, formatCents, formatPlain } from './format';
import { Button, ErrorList } from './ui';

/** Downscale a photo (phone pictures are huge) and return it as base64 JPEG. */
export async function prepareImage(file: File, maxSide = 2000): Promise<ScanImage & { previewUrl: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't open this image. Try a JPG or PNG (iPhone HEIC photos may need converting).");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg', previewUrl: dataUrl };
}

async function scan(provider: 'gemini' | 'anthropic', apiKey: string, image: ScanImage, accounts: Parameters<typeof planScan>[1], today: string): Promise<ScanOutcome> {
  if (provider === 'gemini') {
    const { scanWithGemini } = await import('../engine/parser/geminiParser');
    return scanWithGemini(apiKey, image, accounts, today);
  }
  const { scanWithClaude } = await import('../engine/parser/claudeParser');
  return scanWithClaude(apiKey, image, accounts, today);
}

/**
 * "Scan a page": upload a photo of an exercise or worksheet; the AI reads the opening balances,
 * accounts and transactions, and journalizes them. The user reviews the plan, then posts it all.
 */
export function ScanPage() {
  const accounts = useBooks((s) => s.accounts);
  const entries = useBooks((s) => s.entries);
  const provider = useSettings((s) => s.aiProvider);
  const apiKey = useSettings((s) => s.apiKeys[s.aiProvider]);
  const companyName = useCompanyName();
  const activeId = useCompanies((s) => s.activeId);
  const setPeriodFrom = useCompany((s) => s.setPeriodFrom);

  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<(ScanImage & { previewUrl: string; name: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const runId = useRef(0);

  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const [plan, setPlan] = useState<ScanPlan | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [startFresh, setStartFresh] = useState(false);
  const [adoptName, setAdoptName] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const [readBy, setReadBy] = useState<string | null>(null);

  const hasBooks = entries.length > 0;
  const postable = useMemo(() => plan?.entries.filter((e) => !e.problems.length).length ?? 0, [plan]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setErrors([]);
    setPlan(null);
    setDone(null);
    try {
      setImage({ ...(await prepareImage(file)), name: file.name });
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  };

  const run = async () => {
    if (!image) return;
    setBusy(true);
    setErrors([]);
    setPlan(null);
    setDone(null);
    const id = ++runId.current;
    const out = await scan(provider, apiKey, image, accounts, todayISO());
    if (id !== runId.current) return; // cancelled while waiting
    setBusy(false);
    if (!out.ok) return setErrors([out.reason]);
    setReadBy(out.model && out.model !== PROVIDERS[provider].model ? out.model : null);
    const p = planScan(out.scan, accounts, todayISO());
    if (!p.entries.length && !p.opening) return setErrors(["The AI didn't find any balances or transactions on this page."]);
    setPlan(p);
    setStartFresh(hasBooks && !!p.opening);
  };

  const post = () => {
    if (!plan) return;
    // One click, no dialog: the Undo bar reverses the whole post (including "start fresh").
    let r!: ReturnType<typeof applyScan>;
    undoable('Posted the scanned page', () => {
      r = applyScan(useBooks.getState(), plan, { startFresh });
      useBooks.setState({ accounts: r.books.accounts, entries: r.books.entries, nextSeq: r.books.nextSeq });
      if (adoptName && plan.companyName && isPlaceholderName(companyName)) renameCompany(activeId, plan.companyName);
      if (r.openingPosted && plan.opening) setPeriodFrom(plan.opening.date);
    });
    setDone(
      `Posted ${r.openingPosted ? 'the opening balances and ' : ''}${r.entriesPosted} journal ${r.entriesPosted === 1 ? 'entry' : 'entries'}` +
        (r.accountsAdded ? `, and added ${r.accountsAdded} new ${r.accountsAdded === 1 ? 'account' : 'accounts'}` : '') +
        '. The ledger, T-accounts, trial balance and statements are updated.',
    );
    setErrors(r.skipped.map((s) => `Skipped ${s.description}: ${s.reason}`));
    setPlan(null);
  };

  const lineText = (l: ScanPlan['entries'][number]['lines'][number]) => `${l.side === 'debit' ? 'Dr' : 'Cr'} ${l.accountName} ${formatPlain(l.amount)}`;

  return (
    <div>
      <div className="text-base font-semibold text-slate-900">Scan a page</div>
      <p className="text-sm text-slate-500">
        Upload a photo of an exercise or worksheet. The AI reads the opening balances, accounts and transactions, journalizes them, and you post them all
        with one click.
      </p>

      {!apiKey ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Scanning needs an AI key.{' '}
          <Link to="/settings" className="font-medium underline">
            Add a Gemini or Claude key in Settings
          </Link>
          .
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Photo of a page to scan" onChange={(e) => choose(e.target.files?.[0])} />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {image ? 'Choose a different photo' : 'Choose photo'}
          </Button>
          {image && (
            <>
              <img src={image.previewUrl} alt="Page to scan" className="h-16 w-12 rounded-md border border-slate-400/30 object-cover" />
              <span className="max-w-[12rem] truncate text-sm text-slate-600">{image.name}</span>
              <Button variant="primary" onClick={run} disabled={busy}>
                {busy ? 'Reading the page…' : `Scan with ${PROVIDERS[provider].model}`}
              </Button>
            </>
          )}
          {busy && (
            <>
              <span className="text-sm text-slate-500">Reading… {seconds}s. A full page can take up to a minute or two.</span>
              <Button
                onClick={() => {
                  runId.current++;
                  setBusy(false);
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {done && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{done}</p>}
        <ErrorList errors={errors} />
      </div>

      {plan && (
        <div className="field pop-in mt-4 space-y-4 rounded-2xl p-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
            {plan.companyName && (
              <span>
                <strong>{plan.companyName}</strong>
              </span>
            )}
            <span>{plan.newAccounts.length} new accounts</span>
            <span>{plan.opening ? `Opening balances as of ${fmtDate(plan.opening.date)}` : 'No opening balances'}</span>
            <span>
              {postable} of {plan.entries.length} entries ready
            </span>
          </div>

          {readBy && (
            <p className="text-xs text-slate-500">
              {PROVIDERS[provider].model} was busy, so {readBy} read this page.
            </p>
          )}

          {plan.notes && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <strong>The AI noted:</strong> {plan.notes}
            </p>
          )}

          {plan.newAccounts.length > 0 && (
            <details open>
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">New accounts to add</summary>
              <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-sm text-slate-700 sm:grid-cols-2">
                {plan.newAccounts.map((a) => (
                  <li key={a.name}>
                    {a.name} <span className="text-slate-500">· {TYPE_LABELS[a.type]}{a.contra ? ' (contra)' : ''}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {plan.opening && (
            <details open>
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Opening balances · {fmtDate(plan.opening.date)}</summary>
              <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-sm text-slate-700 sm:grid-cols-2">
                {plan.opening.lines.map((l) => (
                  <li key={l.accountName} className="flex justify-between gap-3">
                    <span>{l.accountName}</span>
                    <span className="tabular-nums">
                      {l.side === 'debit' ? 'Dr' : 'Cr'} {formatCents(l.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              <ErrorList errors={plan.opening.problems} />
            </details>
          )}

          {plan.entries.length > 0 && (
            <details open>
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Journal entries ({plan.entries.length})</summary>
              <ul className="mt-2 divide-y divide-slate-400/20 text-sm">
                {plan.entries.map((e, i) => (
                  <li key={i} className={cx('py-1.5', e.problems.length > 0 && 'text-red-700')}>
                    <div className="flex flex-wrap gap-x-3">
                      <span className="w-24 shrink-0 text-slate-500">{fmtDate(e.date)}</span>
                      <span className="font-medium">{e.description}</span>
                    </div>
                    <div className="pl-[6.75rem] text-slate-600">{e.lines.map(lineText).join(' · ')}</div>
                    {e.problems.length > 0 && <div className="pl-[6.75rem] text-xs">Won’t be posted: {e.problems.join(' ')}</div>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="space-y-1.5 text-sm text-slate-800">
            {hasBooks && (
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-cyan-700" checked={startFresh} onChange={(e) => setStartFresh(e.target.checked)} />
                Start fresh: clear my current journal and opening balances first
              </label>
            )}
            {plan.companyName && isPlaceholderName(companyName) && (
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-cyan-700" checked={adoptName} onChange={(e) => setAdoptName(e.target.checked)} />
                Use “{plan.companyName}” as the company name
              </label>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" className="px-5 py-2" onClick={post} disabled={!postable && !plan.opening}>
              Post all to the books
            </Button>
            <Button onClick={() => setPlan(null)}>Discard</Button>
          </div>
        </div>
      )}
    </div>
  );
}
