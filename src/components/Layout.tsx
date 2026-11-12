import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useBooks } from '../store/useBooks';
import { useSettings, type ThemePref } from '../store/useSettings';
import { cx } from './format';
import { useApplyTheme } from './useTheme';

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

/** Fixed positions so the bubbles don't jump around between renders. */
const BUBBLES = [
  { left: '8%', size: 14, dur: 19, delay: 0 },
  { left: '22%', size: 26, dur: 27, delay: -9 },
  { left: '41%', size: 10, dur: 16, delay: -4 },
  { left: '63%', size: 20, dur: 24, delay: -14 },
  { left: '78%', size: 12, dur: 18, delay: -7 },
  { left: '91%', size: 30, dur: 31, delay: -20 },
];

function OceanBackground() {
  return (
    <div className="ocean" aria-hidden="true">
      <div className="blob a" />
      <div className="blob b" />
      <div className="blob c" />
      {BUBBLES.map((b, i) => (
        <span key={i} className="bubble" style={{ left: b.left, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
      ))}
    </div>
  );
}

const THEME_ICONS: Record<ThemePref, { icon: string; label: string }> = {
  system: { icon: '◐', label: 'Match device' },
  light: { icon: '☀', label: 'Light' },
  dark: { icon: '☾', label: 'Dark' },
};

function ThemeSwitch() {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  return (
    <div role="radiogroup" aria-label="Theme" className="glass-inset flex rounded-full p-1">
      {(Object.keys(THEME_ICONS) as ThemePref[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          aria-label={THEME_ICONS[t].label}
          title={THEME_ICONS[t].label}
          onClick={() => setTheme(t)}
          className={cx(
            'flex-1 rounded-full py-1 text-sm transition-all duration-300 ease-bubble',
            theme === t ? 'bubble-active text-white' : 'text-slate-500 hover:text-slate-900',
          )}
        >
          {THEME_ICONS[t].icon}
        </button>
      ))}
    </div>
  );
}

export function Layout() {
  useApplyTheme();
  const [open, setOpen] = useState(false);
  const loadSample = useBooks((s) => s.loadSample);
  const reset = useBooks((s) => s.reset);
  const hasEntries = useBooks((s) => s.entries.length > 0);

  const confirmThen = (msg: string, fn: () => void) => {
    if (!hasEntries || window.confirm(msg)) fn();
  };

  return (
    <div className="min-h-screen lg:flex lg:gap-2 lg:p-3">
      <OceanBackground />

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-20 m-2 flex items-center justify-between rounded-full px-5 py-2.5 lg:hidden print:hidden">
        <span className="font-bold text-slate-900">
          <span className="mr-1.5">🫧</span>Better Accounting
        </span>
        <button
          type="button"
          className="glass-inset rounded-full px-4 py-1 text-sm font-semibold text-slate-700"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </header>

      <aside
        className={cx(
          'glass z-10 mx-2 mb-2 rounded-[1.75rem] lg:sticky lg:top-3 lg:m-0 lg:flex lg:h-[calc(100vh-1.5rem)] lg:w-64 lg:shrink-0 lg:flex-col print:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <div className="hidden px-6 pb-3 pt-6 lg:block">
          <div className="text-lg font-bold text-slate-900">
            <span className="mr-1.5">🫧</span>Better Accounting
          </div>
          <div className="text-xs text-slate-500">Plain-English bookkeeping</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3 lg:py-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  'block rounded-full px-4 py-2 text-sm transition-all duration-300 ease-bubble',
                  isActive ? 'bubble-active font-semibold text-white' : 'text-slate-600 hover:translate-x-1 hover:bg-white/30 hover:text-slate-900',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-slate-400/20 p-3">
          <div className="px-1 pb-2">
            <ThemeSwitch />
          </div>
          <button
            type="button"
            className="block w-full rounded-full px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-white/30"
            onClick={() => confirmThen('Replace your current books with sample data?', loadSample)}
          >
            Load sample data
          </button>
          <button
            type="button"
            className="block w-full rounded-full px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-500/10"
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
