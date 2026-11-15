import { useNavigate } from 'react-router-dom';
import { switchCompany } from '../store/companyActions';
import { useCompanies } from '../store/useCompanies';
import { cx } from './format';

/** A compact dropdown in the top bar to switch company. Only shown when there is more than one. */
export function CompanySwitcher({ className }: { className?: string }) {
  const companies = useCompanies((s) => s.companies);
  const activeId = useCompanies((s) => s.activeId);
  const navigate = useNavigate();
  if (companies.length < 2) {
    // One company: show its name beside the brand (click to rename it in Settings).
    const name = companies.find((c) => c.id === activeId)?.name ?? companies[0]?.name ?? '';
    return (
      <button
        type="button"
        title="Company settings"
        onClick={() => navigate('/settings', { state: { scrollTo: 'companies' } })}
        className={cx('max-w-[12rem] truncate rounded-full px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-400/30 hover:text-slate-900', className)}
      >
        {name}
      </button>
    );
  }
  return (
    <select
      aria-label="Switch company"
      value={activeId}
      onChange={(e) => {
        if (e.target.value === '__manage') navigate('/settings', { state: { scrollTo: 'companies' } });
        else switchCompany(e.target.value);
      }}
      className={cx('field max-w-[12rem] truncate rounded-full py-1 pl-3 pr-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400/60', className)}
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value="__manage">Manage companies…</option>
    </select>
  );
}
