import type { Account } from './types';

export type AccountGroup = 'current' | 'noncurrent';

const FIXED_ASSET = /equipment|vehicle|truck|machinery|furniture|fixture|building|\bland\b|computer|accumulated/i;
const LONG_TERM = /loan|mortgage|notes?\s+payable|bond|debenture|long[- ]?term/i;

/** The best guess for an account when the user hasn't chosen: fixed assets and loans are non-current. */
export function autoGroup(a: Pick<Account, 'type' | 'name' | 'number'>): AccountGroup {
  if (a.type === 'asset') return FIXED_ASSET.test(a.name) || a.number >= 1500 ? 'noncurrent' : 'current';
  if (a.type === 'liability') return LONG_TERM.test(a.name) ? 'noncurrent' : 'current';
  return 'current';
}

/** The class used on the classified balance sheet: the user's choice, else the automatic guess. */
export function accountGroup(a: Account): AccountGroup {
  return a.group ?? autoGroup(a);
}
