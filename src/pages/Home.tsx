import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { StatTiles } from '../components/apple';
import { fmtDate, formatCents } from '../components/format';
import { useNav } from '../components/Layout';
import { Card, PageHeader } from '../components/ui';
import { entryNumberLabel, sortEntries } from '../engine/journal';
import { balanceSheet } from '../engine/reports';
import { useBooks } from '../store/useBooks';
import { useCompanyName } from '../store/useCompanies';

const DESCRIPTIONS: Record<string, string> = {
  '/add': 'Type a transaction in plain English, scan a page, or post one by hand.',
  '/journal': 'Every entry in date order. Edit, delete or highlight accounts.',
  '/ledger': 'Each account’s activity with a running balance.',
  '/t-accounts': 'Debits on the left, credits on the right.',
  '/trial-balance': 'Check that debits equal credits.',
  '/balance-sheet': 'What you own, what you owe, and the owner’s equity.',
  '/income-statement': 'Revenue less expenses for a period.',
  '/settings': 'Companies, accounts, opening balances, AI and appearance.',
};

/** The landing page behind the "Better Accounting" brand in the corner. */
export function Home() {
  const company = useCompanyName();
  const accounts = useBooks((s) => s.accounts);
  const entries = useBooks((s) => s.entries);
  const nav = useNav();
  const bs = useMemo(() => balanceSheet(accounts, entries), [accounts, entries]);
  const cash = bs.assets.find((l) => l.account.systemKey === 'cash')?.amount ?? 0;
  const latest = useMemo(() => sortEntries(entries).slice(-5).reverse(), [entries]);

  return (
    <div className="space-y-8">
      <PageHeader title={company ? `Welcome to ${company}` : 'Welcome'} subtitle="Your books at a glance. Everything here updates as you post." />

      <StatTiles
        tiles={[
          { label: 'Cash', cents: cash },
          { label: 'Total assets', cents: bs.totalAssets },
          { label: 'Total liabilities', cents: bs.totalLiabilities },
          { label: 'Net income to date', cents: bs.netIncome, tone: bs.netIncome < 0 ? 'negative' : 'default' },
        ]}
      />

      <div className="flex flex-wrap gap-3">
        <Link to="/add" className="pill-active rounded-full px-5 py-2.5 text-sm font-semibold text-white">
          Add a transaction
        </Link>
        <Link to="/add" state={{ scrollTo: 'scan' }} className="field rounded-full px-5 py-2.5 text-sm font-semibold text-slate-800">
          Scan a page
        </Link>
        <Link to="/settings" state={{ scrollTo: 'opening-balances' }} className="field rounded-full px-5 py-2.5 text-sm font-semibold text-slate-800">
          Opening balances
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-900">Latest entries</h2>
        <Card className="divide-y divide-slate-400/20 overflow-hidden">
          {latest.length === 0 && (
            <div className="px-5 py-6 text-sm text-slate-500">
              Nothing posted yet. <Link to="/add" className="font-semibold text-cyan-700 hover:underline">Add your first transaction</Link>, or set your opening balances in Settings.
            </div>
          )}
          {latest.map((e) => (
            <Link key={e.id} to="/journal" className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm hover:bg-slate-400/10">
              <span className="min-w-0">
                <span className="text-slate-500">
                  {entryNumberLabel(e)} · {fmtDate(e.date)}
                </span>
                <span className="block truncate text-slate-900">{e.description}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-800">{formatCents(e.lines.reduce((s, l) => s + l.debit, 0))}</span>
            </Link>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-900">Go to</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nav.map((t) => (
            <Link key={t.to} to={t.to} className="card block rounded-2xl p-4 transition-transform hover:-translate-y-0.5">
              <div className="font-semibold text-slate-900">{t.label}</div>
              <div className="mt-1 text-sm text-slate-500">{DESCRIPTIONS[t.to]}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
