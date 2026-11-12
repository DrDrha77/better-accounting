import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useBooks } from '../store/useBooks';
import { cx } from './format';

export const NAV = [
  { to: '/', label: 'Add Transaction' },
  { to: '/journal', label: 'Journal' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/t-accounts', label: 'T-Accounts' },
  { to: '/trial-balance', label: 'Trial Balance' },
  { to: '/income-statement', label: 'Income Statement' },
  { to: '/balance-sheet', label: 'Balance Sheet' },
  { to: '/owners-equity', label: "Owner's Equity" },
  { to: '/opening-statement', label: 'Opening Statement' },
  { to: '/opening-balances', label: 'Opening Balances' },
  { to: '/accounts', label: 'Chart of Accounts' },
  { to: '/settings', label: 'Settings' },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const loadSample = useBooks((s) => s.loadSample);
  const reset = useBooks((s) => s.reset);
  const hasEntries = useBooks((s) => s.entries.length > 0);

  const confirmThen = (msg: string, fn: () => void) => {
    if (!hasEntries || window.confirm(msg)) fn();
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden print:hidden">
        <span className="font-semibold text-slate-900">Better Accounting</span>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1 text-sm"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </header>

      <aside
        className={cx(
          'border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:flex-col print:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <div className="hidden px-5 py-5 lg:block">
          <div className="text-lg font-semibold text-slate-900">Better Accounting</div>
          <div className="text-xs text-slate-500">Plain-English bookkeeping</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 lg:py-0">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  'block rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-slate-200 p-3">
          <button
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => confirmThen('Replace your current books with sample data?', loadSample)}
          >
            Load sample data
          </button>
          <button
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => confirmThen('Erase all entries and reset the chart of accounts? This cannot be undone.', reset)}
          >
            Reset books
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 print:p-0">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
