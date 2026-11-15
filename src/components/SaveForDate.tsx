import { useState } from 'react';
import { todayISO } from '../engine/journal';
import { useCompany } from '../store/useCompany';
import { fmtDate } from './format';
import { Button, inputClass } from './ui';

/**
 * "Save for date": pick a date that new entries default to (handy when catching up on an
 * earlier month). Applies to Quick post, plain-English entries without a date, and blank drafts.
 */
export function SaveForDate({ className }: { className?: string }) {
  const entryDate = useCompany((s) => s.entryDate);
  const setEntryDate = useCompany((s) => s.setEntryDate);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(entryDate || todayISO());

  return (
    <div className="relative">
      <Button
        className={className}
        aria-expanded={open}
        onClick={() => {
          setDraft(entryDate || todayISO());
          setOpen((o) => !o);
        }}
      >
        {entryDate ? `Saving for ${fmtDate(entryDate)}` : 'Save for date'}
      </Button>
      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Default date for new entries" className="card-strong pop-in absolute left-0 z-40 mt-2 w-72 space-y-3 rounded-2xl p-4">
            <div className="text-sm font-semibold text-slate-900">Default date for new entries</div>
            <p className="text-xs text-slate-600">Quick post, typed sentences without a date, and blank drafts will start on this date.</p>
            <input type="date" aria-label="Default entry date" className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!draft}
                onClick={() => {
                  setEntryDate(draft === todayISO() ? '' : draft);
                  setOpen(false);
                }}
              >
                Save
              </Button>
              <Button
                onClick={() => {
                  setEntryDate('');
                  setOpen(false);
                }}
              >
                Use today
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
