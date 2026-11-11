import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../components/format';
import { ReportShell } from '../components/ReportShell';
import { EmptyState } from '../components/ui';
import { openingStatement } from '../engine/reports';
import { useBooks } from '../store/useBooks';
import { BalanceSheetBody, balanceSheetCsv } from './BalanceSheet';

/** The business's financial position at the opening-balance date, from the opening entry alone. */
export function OpeningStatement() {
  const { accounts, entries } = useBooks();
  const os = useMemo(() => openingStatement(accounts, entries), [accounts, entries]);

  return (
    <ReportShell
      title="Opening Statement"
      subtitle="Opening balance sheet: the position you started the books with, before any transactions."
      csvName="opening-statement.csv"
      csvRows={() => (os ? balanceSheetCsv(os, 'Opening Statement') : [['No opening balance entered']])}
    >
      {os ? (
        <>
          <BalanceSheetBody bs={os} title="Opening Statement" period={`As of ${fmtDate(os.asOf)}`} showNetIncome={false} />
          <p className="mt-4 text-center text-sm print:hidden">
            <Link to="/opening-balances" className="text-emerald-700 hover:underline">
              Edit opening balances →
            </Link>
          </p>
        </>
      ) : (
        <EmptyState>
          No opening balances yet.{' '}
          <Link to="/opening-balances" className="text-emerald-700 underline">
            Enter opening balances
          </Link>{' '}
          to see the opening statement.
        </EmptyState>
      )}
    </ReportShell>
  );
}
