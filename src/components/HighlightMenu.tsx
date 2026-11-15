import { useEffect, useState } from 'react';
import { ACCOUNT_TYPES, sortAccounts, TYPE_LABELS } from '../engine/accounts';
import type { Account } from '../engine/types';
import { cx } from './format';
import { Button } from './ui';

/**
 * "Highlight" in the Journal toolbar: a compact dropdown (not a tall list) to pick accounts whose
 * entries should stand out. A plain click picks just that account; Cmd/Ctrl-click adds or removes
 * accounts and keeps the menu open.
 */
export function HighlightMenu({ accounts, selected, onChange, className }: { accounts: Account[]; selected: Set<string>; onChange: (next: Set<string>) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const chosen = [...selected].map((id) => byId.get(id)?.name).filter(Boolean) as string[];
  const label = chosen.length === 0 ? 'Highlight' : chosen.length === 1 ? `Highlight: ${chosen[0]}` : `Highlight: ${chosen[0]} +${chosen.length - 1}`;

  const pick = (id: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(next);
      return; // stays open so more accounts can be added
    }
    // A plain click picks just this account (or turns it off if it's the only one on).
    onChange(selected.size === 1 && selected.has(id) ? new Set() : new Set([id]));
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button className={cx(className, selected.size > 0 && 'ring-2 ring-amber-500/60')} aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((o) => !o)}>
        <span className="max-w-[13rem] truncate">{label}</span>
        <span aria-hidden="true">▾</span>
      </Button>
      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="listbox" aria-multiselectable="true" aria-label="Accounts to highlight" className="card-strong pop-in absolute left-0 z-40 mt-2 w-64 rounded-2xl p-2 shadow-xl">
            <div className="max-h-52 overflow-y-auto pr-1">
              {ACCOUNT_TYPES.map((t) => {
                const list = sortAccounts(accounts.filter((a) => a.type === t));
                if (!list.length) return null;
                return (
                  <div key={t} className="mb-1">
                    <div className="px-2 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{TYPE_LABELS[t]}</div>
                    {list.map((a) => {
                      const on = selected.has(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          role="option"
                          aria-selected={on}
                          onClick={(e) => pick(a.id, e)}
                          className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm', on ? 'bg-amber-400/30 font-semibold text-slate-900' : 'text-slate-800 hover:bg-slate-500/10')}
                        >
                          <span className="w-4 shrink-0 text-amber-700">{on ? '✓' : ''}</span>
                          <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-400/25 px-2 pt-2 text-xs text-slate-500">
              <span>Click to pick one · Cmd/Ctrl-click to add more</span>
              {selected.size > 0 && (
                <button type="button" className="shrink-0 font-semibold text-cyan-700 hover:underline" onClick={() => onChange(new Set())}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
