import { useNavigate } from 'react-router-dom';
import { switchCompany } from '../store/companyActions';
import { useCompanies } from '../store/useCompanies';
import { cx } from './format';

/** A compact dropdown in the top bar to switch company. Only shown when there is more than one. */
export function CompanySwitcher({ className }: { className?: string }) {
  const companies = useCompanies((s) => s.companies);
  const activeId = useCompanies((s) => s.activeId);
  const navigate = useNavigate();
  if (companies.length < 2) return null;
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
