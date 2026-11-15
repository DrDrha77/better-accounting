import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSaveStatus } from '../store/safeStorage';
import { useCompanies } from '../store/useCompanies';
import { CompanySwitcher } from './CompanySwitcher';
import { UndoBar } from './UndoBar';
import { useSettings } from '../store/useSettings';
import { cx } from './format';
import { useSlidingIndicator } from './useSlidingIndicator';
import { useApplyTheme } from './useTheme';

export const NAV = [
  { to: '/journal', label: 'Journal' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/t-accounts', label: 'T-Accounts' },
  { to: '/trial-balance', label: 'Trial Balance' },
  { to: '/balance-sheet', label: 'Balance Sheet' },
  { to: '/income-statement', label: 'Income Statement' },
  { to: '/settings', label: 'Settings' },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'relative z-10 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[15px] transition-colors duration-300',
    isActive ? 'font-semibold text-white' : 'text-slate-700 hover:bg-slate-500/10 hover:text-slate-900',
  );

/** Re-mounts the page on navigation so it plays the enter animation, and scrolls to the top. */
function AnimatedOutlet() {
  const location = useLocation();
  // A different company means different data, so every page remounts fresh.
  const activeId = useCompanies((s) => s.activeId);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  return (
    <div key={`${activeId}:${location.pathname}`} className="page-enter">
      <Outlet />
    </div>
  );
}

/** Shown on every page when the browser refuses to save. */
function SaveFailedBanner({ maxWidth }: { maxWidth: string }) {
  const saveFailed = useSaveStatus((s) => s.failed);
  if (!saveFailed) return null;
  return (
    <div role="alert" className={cx('mx-auto mt-3 px-3 sm:px-4 print:hidden', maxWidth)}>
      <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-300">
        <strong>Your changes can't be saved in this browser right now</strong> (a private window or full storage). Your work will be lost when you close this
        page. Download a backup in <NavLink to="/settings" className="font-semibold underline">Settings</NavLink>.
      </div>
    </div>
  );
}

/** Picks the chosen design: the classic mint layout or the Apple-style one. */
export function Layout() {
  useApplyTheme();
  const design = useSettings((s) => s.design);
  return (
    <>
      {design === 'apple' ? <AppleLayout /> : <ClassicLayout />}
      <UndoBar />
    </>
  );
}

const appleTabClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'relative z-10 whitespace-nowrap rounded-full px-3.5 py-1 text-[13px] transition-colors duration-200',
    isActive ? 'font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900',
  );

/** Thin frosted bar with the brand on the left and the pages beside it, like apple.com. */
function AppleLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { containerRef: tabsRef, indicator: tabPill } = useSlidingIndicator<HTMLElement>([location.pathname]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="apple-nav print:hidden">
        <div className="mx-auto flex h-12 max-w-[1180px] items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <NavLink to="/journal" className="whitespace-nowrap text-[17px] font-semibold tracking-tight text-slate-900">
              Better Accounting
            </NavLink>
            <CompanySwitcher className="!py-0.5 text-[13px]" />
          </div>

          <nav ref={tabsRef} className="relative hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {tabPill}
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} data-tab className={appleTabClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <button type="button" className="text-[13px] font-medium text-cyan-700 lg:hidden" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {menuOpen && (
          <nav className="pop-in border-t border-slate-400/30 px-5 pb-3 pt-1 lg:hidden" aria-label="Main">
            <div className="mx-auto max-w-[1180px]">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cx('block border-b border-slate-400/20 py-2.5 text-[17px] last:border-0', isActive ? 'font-semibold text-slate-900' : 'text-slate-600')
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <SaveFailedBanner maxWidth="max-w-[1180px]" />

      <main className="px-5 pb-16 pt-10 print:p-0">
        <div className="mx-auto max-w-[1180px]">
          <AnimatedOutlet />
        </div>
      </main>
    </div>
  );
}

function ClassicLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { containerRef: tabsRef, indicator: tabPill } = useSlidingIndicator<HTMLElement>([location.pathname]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 print:hidden">
        <div className="card-strong mx-auto flex max-w-[1400px] items-center justify-between gap-4 rounded-2xl px-4 py-2.5 sm:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <NavLink to="/journal" className="brand whitespace-nowrap text-2xl font-extrabold text-cyan-800">
              Better Accounting
            </NavLink>
            <CompanySwitcher />
          </div>

          <nav ref={tabsRef} className="relative hidden items-center gap-1 lg:flex" aria-label="Main">
            {tabPill}
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} data-tab className={tabClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="field rounded-full px-4 py-1.5 text-sm font-semibold text-slate-700 lg:hidden"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {menuOpen && (
          <nav className="card-strong pop-in mx-auto mt-2 max-w-[1400px] space-y-1 rounded-2xl p-2 lg:hidden" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cx('block rounded-full px-4 py-2 text-sm', isActive ? 'pill-active font-semibold text-white' : 'text-slate-700 hover:bg-slate-500/10')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <SaveFailedBanner maxWidth="max-w-[1400px]" />

      <main className="px-3 py-6 sm:px-4 print:p-0">
        <div className="mx-auto max-w-[1400px]">
          <AnimatedOutlet />
        </div>
      </main>
    </div>
  );
}
