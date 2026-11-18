import type { Account, Cents, ISODate, JournalEntry } from './types';
import { trialBalance } from './reports';

export interface WorksheetRow {
  account: Account;
  tbDebit: Cents;
  tbCredit: Cents;
  isDebit: Cents;
  isCredit: Cents;
  bsDebit: Cents;
  bsCredit: Cents;
}

export interface Worksheet {
  rows: WorksheetRow[];
  /** Column totals before the net income line. */
  subtotal: { tbDebit: Cents; tbCredit: Cents; isDebit: Cents; isCredit: Cents; bsDebit: Cents; bsCredit: Cents };
  /** Positive = net income, negative = net loss. */
  netIncome: Cents;
  /** Column totals after the net income / loss line is added, so each pair balances. */
  total: { isDebit: Cents; isCredit: Cents; bsDebit: Cents; bsCredit: Cents };
  balanced: boolean;
}

/**
 * The accountant's work sheet: the trial balance with each account carried to the income statement
 * (revenue, expenses) or the balance sheet (everything else). Net income is the balancing figure.
 */
export function worksheet(accounts: Account[], entries: JournalEntry[], asOf?: ISODate): Worksheet {
  const tb = trialBalance(accounts, entries, asOf);
  const rows: WorksheetRow[] = tb.rows.map(({ account, debit, credit }) => {
    const income = account.type === 'revenue' || account.type === 'expense';
    return {
      account,
      tbDebit: debit,
      tbCredit: credit,
      isDebit: income ? debit : 0,
      isCredit: income ? credit : 0,
      bsDebit: income ? 0 : debit,
      bsCredit: income ? 0 : credit,
    };
  });
  const sum = (k: keyof WorksheetRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const subtotal = { tbDebit: sum('tbDebit'), tbCredit: sum('tbCredit'), isDebit: sum('isDebit'), isCredit: sum('isCredit'), bsDebit: sum('bsDebit'), bsCredit: sum('bsCredit') };
  const netIncome = subtotal.isCredit - subtotal.isDebit;
  const total = {
    isDebit: subtotal.isDebit + (netIncome > 0 ? netIncome : 0),
    isCredit: subtotal.isCredit + (netIncome < 0 ? -netIncome : 0),
    bsDebit: subtotal.bsDebit + (netIncome < 0 ? -netIncome : 0),
    bsCredit: subtotal.bsCredit + (netIncome > 0 ? netIncome : 0),
  };
  return { rows, subtotal, netIncome, total, balanced: total.isDebit === total.isCredit && total.bsDebit === total.bsCredit && subtotal.tbDebit === subtotal.tbCredit };
}
