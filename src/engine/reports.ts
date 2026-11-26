import { accountGroup } from './classify';
import { sortAccounts, typeNormalSide } from './accounts';
import { activityByAccount, filterEntries } from './ledger';
import type { Account, AccountType, Cents, ISODate, JournalEntry } from './types';

// ---------- Trial balance ----------

export interface TrialBalanceRow {
  account: Account;
  debit: Cents;
  credit: Cents;
}

export interface TrialBalance {
  asOf?: ISODate;
  rows: TrialBalanceRow[];
  totalDebit: Cents;
  totalCredit: Cents;
  difference: Cents;
  balanced: boolean;
}

/** Each account's net balance placed in the debit or credit column. Accounts with a zero balance are omitted unless `includeZero`. */
export function trialBalance(
  accounts: Account[],
  entries: JournalEntry[],
  asOf?: ISODate,
  includeZero = false,
): TrialBalance {
  const act = activityByAccount(filterEntries(entries, { to: asOf }));
  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const account of sortAccounts(accounts)) {
    const a = act.get(account.id) ?? { debit: 0, credit: 0 };
    const net = a.debit - a.credit;
    if (net === 0 && !includeZero) continue;
    const row = { account, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
    totalDebit += row.debit;
    totalCredit += row.credit;
    rows.push(row);
  }
  const difference = totalDebit - totalCredit;
  return { asOf, rows, totalDebit, totalCredit, difference, balanced: difference === 0 };
}

// ---------- Shared helpers ----------

export interface StatementLine {
  account: Account;
  /** Amount in the section's normal direction; contra accounts show as negative. */
  amount: Cents;
}

function sectionLines(accounts: Account[], act: ReturnType<typeof activityByAccount>, type: AccountType): StatementLine[] {
  const side = typeNormalSide(type);
  return sortAccounts(accounts.filter((a) => a.type === type))
    .map((account) => {
      const x = act.get(account.id) ?? { debit: 0, credit: 0 };
      return { account, amount: side === 'debit' ? x.debit - x.credit : x.credit - x.debit };
    })
    .filter((l) => l.amount !== 0);
}

const total = (lines: StatementLine[]) => lines.reduce((s, l) => s + l.amount, 0);

// ---------- Income statement ----------

export interface IncomeStatement {
  from?: ISODate;
  to?: ISODate;
  revenues: StatementLine[];
  expenses: StatementLine[];
  totalRevenue: Cents;
  totalExpenses: Cents;
  netIncome: Cents;
}

export function incomeStatementFromEntries(accounts: Account[], entries: JournalEntry[]): Omit<IncomeStatement, 'from' | 'to'> {
  const act = activityByAccount(entries);
  const revenues = sectionLines(accounts, act, 'revenue');
  const expenses = sectionLines(accounts, act, 'expense');
  const totalRevenue = total(revenues);
  const totalExpenses = total(expenses);
  return { revenues, expenses, totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses };
}

export function incomeStatement(accounts: Account[], entries: JournalEntry[], from?: ISODate, to?: ISODate): IncomeStatement {
  return { from, to, ...incomeStatementFromEntries(accounts, filterEntries(entries, { from, to })) };
}

// ---------- Balance sheet ----------

export interface BalanceSheet {
  asOf?: ISODate;
  assets: StatementLine[];
  liabilities: StatementLine[];
  /** Equity accounts (capital, opening balance equity, drawings as a negative line). */
  equity: StatementLine[];
  /** Cumulative net income through the as-of date (no closing entries are posted). */
  netIncome: Cents;
  totalAssets: Cents;
  totalLiabilities: Cents;
  totalEquity: Cents;
  totalLiabilitiesAndEquity: Cents;
  difference: Cents;
  balanced: boolean;
}

export function balanceSheetFromEntries(accounts: Account[], entries: JournalEntry[], asOf?: ISODate): BalanceSheet {
  const act = activityByAccount(entries);
  const assets = sectionLines(accounts, act, 'asset');
  const liabilities = sectionLines(accounts, act, 'liability');
  const equity = sectionLines(accounts, act, 'equity');
  const { netIncome } = incomeStatementFromEntries(accounts, entries);
  const totalAssets = total(assets);
  const totalLiabilities = total(liabilities);
  const totalEquity = total(equity) + netIncome;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const difference = totalAssets - totalLiabilitiesAndEquity;
  return {
    asOf,
    assets,
    liabilities,
    equity,
    netIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    difference,
    balanced: difference === 0,
  };
}

export function balanceSheet(accounts: Account[], entries: JournalEntry[], asOf?: ISODate): BalanceSheet {
  return balanceSheetFromEntries(accounts, filterEntries(entries, { to: asOf }), asOf);
}

// ---------- Opening statement ----------

/** Balance sheet built from the opening-balance entry alone, or null when there is none. */
export function openingStatement(accounts: Account[], entries: JournalEntry[]): BalanceSheet | null {
  const opening = entries.find((e) => e.kind === 'opening');
  if (!opening) return null;
  return balanceSheetFromEntries(accounts, [opening], opening.date);
}

// ---------- Classified balance sheet ----------

export interface ClassifiedBalanceSheet {
  currentAssets: StatementLine[];
  fixedAssets: StatementLine[];
  currentLiabilities: StatementLine[];
  longTermLiabilities: StatementLine[];
  totalCurrentAssets: Cents;
  totalFixedAssets: Cents;
  totalCurrentLiabilities: Cents;
  totalLongTermLiabilities: Cents;
}

/** Split a balance sheet's assets and liabilities into current and fixed / long-term groups. */
export function classify(bs: BalanceSheet): ClassifiedBalanceSheet {
  const cur = (l: StatementLine) => accountGroup(l.account) === 'current';
  const currentAssets = bs.assets.filter(cur);
  const fixedAssets = bs.assets.filter((l) => !cur(l));
  const currentLiabilities = bs.liabilities.filter(cur);
  const longTermLiabilities = bs.liabilities.filter((l) => !cur(l));
  return {
    currentAssets,
    fixedAssets,
    currentLiabilities,
    longTermLiabilities,
    totalCurrentAssets: total(currentAssets),
    totalFixedAssets: total(fixedAssets),
    totalCurrentLiabilities: total(currentLiabilities),
    totalLongTermLiabilities: total(longTermLiabilities),
  };
}

// ---------- Statement of owner's equity ----------

export interface OwnersEquityStatement {
  from?: ISODate;
  to?: ISODate;
  /** Total equity before the period, plus any opening-balance entry dated inside the period. */
  beginningEquity: Cents;
  investments: Cents;
  netIncome: Cents;
  drawings: Cents;
  endingEquity: Cents;
}

/** Equity effect of entries: credits minus debits over equity, revenue and expense accounts. */
function equityEffect(accounts: Account[], entries: JournalEntry[], pick: (a: Account) => boolean): Cents {
  const act = activityByAccount(entries);
  let s = 0;
  for (const a of accounts) {
    if (!pick(a)) continue;
    const x = act.get(a.id);
    if (x) s += x.credit - x.debit;
  }
  return s;
}

export function ownersEquityStatement(
  accounts: Account[],
  entries: JournalEntry[],
  from?: ISODate,
  to?: ISODate,
): OwnersEquityStatement {
  const isEquityRelated = (a: Account) => a.type === 'equity' || a.type === 'revenue' || a.type === 'expense';
  const inPeriod = filterEntries(entries, { from, to });
  const before = from ? entries.filter((e) => e.date < from) : [];
  const openingInPeriod = inPeriod.filter((e) => e.kind === 'opening');
  const activity = inPeriod.filter((e) => e.kind !== 'opening');

  const beginningEquity =
    equityEffect(accounts, before, isEquityRelated) + equityEffect(accounts, openingInPeriod, isEquityRelated);
  const investments = equityEffect(accounts, activity, (a) => a.type === 'equity' && !a.contra);
  const drawings = -equityEffect(accounts, activity, (a) => a.type === 'equity' && !!a.contra);
  const netIncome = equityEffect(accounts, activity, (a) => a.type === 'revenue' || a.type === 'expense');
  return {
    from,
    to,
    beginningEquity,
    investments,
    netIncome,
    drawings,
    endingEquity: beginningEquity + investments + netIncome - drawings,
  };
}
