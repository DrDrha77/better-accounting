import type { Account, AccountType, Side } from './types';

export const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
};

/** Account-number ranges per type: 1000s assets … 5000s expenses. */
export const TYPE_RANGES: Record<AccountType, [number, number]> = {
  asset: [1000, 1999],
  liability: [2000, 2999],
  equity: [3000, 3999],
  revenue: [4000, 4999],
  expense: [5000, 5999],
};

/** Normal side for an account type, ignoring contra. */
export function typeNormalSide(type: AccountType): Side {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit';
}

/** Normal side for a specific account (contra accounts flip their type's side). */
export function normalSide(account: Account): Side {
  const side = typeNormalSide(account.type);
  if (!account.contra) return side;
  return side === 'debit' ? 'credit' : 'debit';
}

/** Balance in the account's normal direction (positive = normal balance). */
export function normalBalance(account: Account, debit: number, credit: number): number {
  return normalSide(account) === 'debit' ? debit - credit : credit - debit;
}

export const SYSTEM_KEYS = {
  cash: 'cash',
  accountsReceivable: 'ar',
  supplies: 'supplies',
  prepaidInsurance: 'prepaid_insurance',
  equipment: 'equipment',
  vehicles: 'vehicles',
  furniture: 'furniture',
  accountsPayable: 'ap',
  notesPayable: 'notes_payable',
  wagesPayable: 'wages_payable',
  unearnedRevenue: 'unearned_revenue',
  ownersCapital: 'capital',
  ownersDrawings: 'drawings',
  openingBalanceEquity: 'opening_balance_equity',
  serviceRevenue: 'service_revenue',
  rentExpense: 'rent_expense',
  wagesExpense: 'wages_expense',
  suppliesExpense: 'supplies_expense',
  utilitiesExpense: 'utilities_expense',
  insuranceExpense: 'insurance_expense',
  advertisingExpense: 'advertising_expense',
  repairsExpense: 'repairs_expense',
  travelExpense: 'travel_expense',
  interestExpense: 'interest_expense',
  miscExpense: 'misc_expense',
} as const;

const K = SYSTEM_KEYS;

function acct(number: number, name: string, type: AccountType, systemKey: string, contra = false): Account {
  return { id: systemKey, number, name, type, systemKey, ...(contra ? { contra } : {}) };
}

export const DEFAULT_ACCOUNTS: Account[] = [
  acct(1000, 'Cash', 'asset', K.cash),
  acct(1100, 'Accounts Receivable', 'asset', K.accountsReceivable),
  acct(1200, 'Supplies', 'asset', K.supplies),
  acct(1300, 'Prepaid Insurance', 'asset', K.prepaidInsurance),
  acct(1500, 'Equipment', 'asset', K.equipment),
  acct(1600, 'Vehicles', 'asset', K.vehicles),
  acct(1700, 'Furniture & Fixtures', 'asset', K.furniture),
  acct(2000, 'Accounts Payable', 'liability', K.accountsPayable),
  acct(2100, 'Notes Payable', 'liability', K.notesPayable),
  acct(2200, 'Wages Payable', 'liability', K.wagesPayable),
  acct(2300, 'Unearned Revenue', 'liability', K.unearnedRevenue),
  acct(3000, "Owner's Capital", 'equity', K.ownersCapital),
  acct(3100, "Owner's Drawings", 'equity', K.ownersDrawings, true),
  acct(3900, 'Opening Balance Equity', 'equity', K.openingBalanceEquity),
  acct(4000, 'Service Revenue', 'revenue', K.serviceRevenue),
  acct(5000, 'Rent Expense', 'expense', K.rentExpense),
  acct(5100, 'Wages Expense', 'expense', K.wagesExpense),
  acct(5200, 'Supplies Expense', 'expense', K.suppliesExpense),
  acct(5300, 'Utilities Expense', 'expense', K.utilitiesExpense),
  acct(5400, 'Insurance Expense', 'expense', K.insuranceExpense),
  acct(5500, 'Advertising Expense', 'expense', K.advertisingExpense),
  acct(5600, 'Repairs & Maintenance Expense', 'expense', K.repairsExpense),
  acct(5700, 'Travel Expense', 'expense', K.travelExpense),
  acct(5800, 'Interest Expense', 'expense', K.interestExpense),
  acct(5900, 'Miscellaneous Expense', 'expense', K.miscExpense),
];

export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => a.number - b.number);
}

export function findBySystemKey(accounts: Account[], key: string): Account | undefined {
  return accounts.find((a) => a.systemKey === key);
}

export function accountLabel(a: Account): string {
  return `${a.number} · ${a.name}`;
}

/** Suggest the next free account number within the type's range (steps of 10). */
export function suggestAccountNumber(accounts: Account[], type: AccountType): number {
  const [lo, hi] = TYPE_RANGES[type];
  const used = new Set(accounts.map((a) => a.number));
  const inRange = accounts.filter((a) => a.number >= lo && a.number <= hi).map((a) => a.number);
  let n = inRange.length ? Math.max(...inRange) + 10 : lo;
  n = Math.ceil(n / 10) * 10;
  while (n <= hi && used.has(n)) n += 10;
  if (n <= hi) return n;
  for (let i = lo; i <= hi; i++) if (!used.has(i)) return i;
  return hi;
}

export function typeForNumber(n: number): AccountType | undefined {
  return ACCOUNT_TYPES.find((t) => n >= TYPE_RANGES[t][0] && n <= TYPE_RANGES[t][1]);
}

/**
 * Add any default accounts that a saved chart of accounts is missing (e.g. after an app update
 * introduces new defaults). Skips one whose systemKey, number or name is already taken.
 */
export function withMissingDefaults(accounts: Account[]): Account[] {
  const keys = new Set(accounts.map((a) => a.systemKey).filter(Boolean));
  const ids = new Set(accounts.map((a) => a.id));
  const numbers = new Set(accounts.map((a) => a.number));
  const names = new Set(accounts.map((a) => a.name.toLowerCase()));
  const added = DEFAULT_ACCOUNTS.filter(
    (d) => !keys.has(d.systemKey) && !ids.has(d.id) && !numbers.has(d.number) && !names.has(d.name.toLowerCase()),
  ).map((d) => ({ ...d }));
  return added.length ? [...accounts, ...added] : accounts;
}
