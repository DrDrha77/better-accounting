import type { ReactNode } from 'react';
import { useSettings } from '../store/useSettings';
import { cx, formatCents } from './format';

/** True when the Apple-style design is chosen. Pages use it to swap their layout, not just their colors. */
export function useIsApple(): boolean {
  return useSettings((s) => s.design === 'apple');
}

export type Tone = 'default' | 'positive' | 'negative';

const TONE: Record<Tone, string> = {
  default: 'text-slate-900',
  positive: 'text-emerald-700',
  negative: 'text-red-600',
};

export interface Tile {
  label: string;
  cents: number;
  tone?: Tone;
  note?: string;
}

/** Big-number summary tiles at the top of a statement, like the numbers on an Apple product page. */
export function StatTiles({ tiles, compact = false }: { tiles: Tile[]; compact?: boolean }) {
  return (
    <div className={cx('grid gap-3', tiles.length === 2 && 'sm:grid-cols-2', tiles.length >= 3 && 'sm:grid-cols-3')}>
      {tiles.map((t) => (
        <div key={t.label} className={cx(compact ? 'field rounded-2xl p-4' : 'card rounded-3xl p-5 sm:p-6')}>
          <div className="text-sm font-medium text-slate-500">{t.label}</div>
          <div className={cx('mt-1 font-semibold tabular-nums tracking-tight', compact ? 'text-2xl' : 'text-3xl sm:text-[2.5rem] sm:leading-tight', TONE[t.tone ?? 'default'])}>
            {formatCents(t.cents)}
          </div>
          {t.note && <div className="mt-1 text-xs text-slate-500">{t.note}</div>}
        </div>
      ))}
    </div>
  );
}

/** A titled, rounded list of rows with hairline dividers, like an inset grouped list in iOS. */
export function ListSection({ title, children, inset = false }: { title?: string; children: ReactNode; inset?: boolean }) {
  return (
    <section>
      {title && <h3 className="mb-2 px-2 text-sm font-semibold text-slate-500">{title}</h3>}
      <div className={cx('divide-y divide-slate-400/20 overflow-hidden rounded-3xl', inset ? 'bg-slate-400/10' : 'card')}>{children}</div>
    </section>
  );
}

export function money(cents: number): string {
  return cents < 0 ? `(${formatCents(-cents)})` : formatCents(cents);
}

export function ListRow({ label, sub, amount, strong = false, muted = false }: { label: ReactNode; sub?: ReactNode; amount?: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 px-5 py-3', strong && 'bg-slate-400/10')}>
      <div className="min-w-0">
        <div className={cx('text-[15px]', strong ? 'font-semibold text-slate-900' : muted ? 'text-slate-500' : 'text-slate-800')}>{label}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
      {amount !== undefined && (
        <div className={cx('shrink-0 text-[15px] tabular-nums', strong ? 'font-semibold text-slate-900' : 'text-slate-800')}>{money(amount)}</div>
      )}
    </div>
  );
}

/** Centered company / statement name / period above a statement. */
export function AppleStatementHeader({ company, title, period }: { company?: string; title: string; period: string }) {
  return (
    <div className="pb-1 text-center">
      {company && <div className="text-sm font-semibold text-slate-500">{company}</div>}
      <div className="text-xl font-semibold tracking-tight text-slate-900">{title}</div>
      <div className="text-sm text-slate-500">{period}</div>
    </div>
  );
}
