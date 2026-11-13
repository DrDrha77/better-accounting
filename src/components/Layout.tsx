import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  return (
    <div key={location.pathname} className="page-enter">
      <Outlet />
    </div>
  );
}

export function Layout() {
  useApplyTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { containerRef: tabsRef, indicator: tabPill } = useSlidingIndicator<HTMLElement>([location.pathname]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 print:hidden">
        <div className="card-strong mx-auto flex max-w-[1400px] items-center justify-between gap-4 rounded-2xl px-4 py-2.5 sm:px-5">
          <NavLink to="/journal" className="brand whitespace-nowrap text-2xl font-extrabold text-cyan-800">
            Better Accounting
          </NavLink>

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

      <main className="px-3 py-6 sm:px-4 print:p-0">
        <div className="mx-auto max-w-[1400px]">
          <AnimatedOutlet />
        </div>
      </main>
    </div>
  );
}
