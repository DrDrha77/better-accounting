import { UNDO_SECONDS, useUndo } from '../store/useUndo';

/** A small bar at the bottom of the screen after a one-click action, with an Undo button for a few seconds. */
export function UndoBar() {
  const item = useUndo((s) => s.item);
  const run = useUndo((s) => s.run);
  const dismiss = useUndo((s) => s.dismiss);
  if (!item) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
      <div key={item.id} className="card-strong pop-in flex max-w-xl items-center gap-2 rounded-full py-2 pl-5 pr-2 shadow-xl ring-1 ring-slate-400/30" title={`Undo is available for ${UNDO_SECONDS} seconds`}>
        <span className="min-w-0 text-sm text-slate-800">{item.message}</span>
        <button type="button" className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-cyan-700 hover:bg-cyan-700/10" onClick={run}>
          Undo
        </button>
        <button type="button" aria-label="Dismiss" className="shrink-0 rounded-full px-2.5 py-1 text-slate-500 hover:text-slate-900" onClick={dismiss}>
          ✕
        </button>
      </div>
    </div>
  );
}
