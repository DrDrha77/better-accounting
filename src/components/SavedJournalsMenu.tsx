import { useState } from 'react';
import { restoreSavedJournal, type SavedJournal } from '../engine/savedJournals';
import { undoable } from '../store/companyActions';
import { useBooks } from '../store/useBooks';
import { useSavedJournals } from '../store/useSavedJournals';
import { Button, inputClass } from './ui';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * "Saved journals": keep named snapshots of this company's journal and restore them later. Restore and
 * Delete both happen on one click; the Undo bar reverses them.
 */
export function SavedJournalsMenu({ className }: { className?: string }) {
  const items = useSavedJournals((s) => s.items);
  const entryCount = useBooks((s) => s.entries.length);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const save = () => {
    const b = useBooks.getState();
    useSavedJournals.getState().save({ accounts: b.accounts, entries: b.entries, nextSeq: b.nextSeq }, name);
    setName('');
  };

  const restore = (j: SavedJournal) =>
    undoable(`Restored saved journal “${j.name}”`, () => {
      const b = useBooks.getState();
      useBooks.getState().restore(restoreSavedJournal({ accounts: b.accounts, entries: b.entries, nextSeq: b.nextSeq }, j));
    });

  const remove = (j: SavedJournal) =>
    undoable(`Deleted saved journal “${j.name}”`, () => {
      useSavedJournals.getState().remove(j.id);
    });

  return (
    <div className="relative">
      <Button className={className} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Saved journals{items.length > 0 ? ` (${items.length})` : ''} <span aria-hidden="true">▾</span>
      </Button>
      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Saved journals" className="card-strong pop-in absolute left-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-2xl p-4 shadow-xl">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input aria-label="Name for the saved journal" className={inputClass} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" variant="primary" disabled={entryCount === 0} title={entryCount === 0 ? 'Nothing in the journal to save yet' : 'Save a snapshot of the journal'}>
                Save
              </Button>
            </form>
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No saved journals yet. Save one to keep a snapshot you can come back to.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {items.map((j) => (
                  <li key={j.id} className="rounded-xl bg-slate-400/10 px-3 py-2">
                    <div className="truncate text-sm font-semibold text-slate-900">{j.name}</div>
                    <div className="text-xs text-slate-500">
                      {j.entryCount} {j.entryCount === 1 ? 'entry' : 'entries'} · {when(j.savedAt)}
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <Button className="!px-3 !py-1 text-xs" onClick={() => restore(j)}>
                        Restore
                      </Button>
                      <Button variant="danger" className="!px-3 !py-1 text-xs" onClick={() => remove(j)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
