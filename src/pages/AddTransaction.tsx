import { Link } from 'react-router-dom';
import { ScanPage } from '../components/ScanPage';
import { TransactionComposer } from '../components/TransactionComposer';
import { Card, PageHeader } from '../components/ui';

/** One place to add transactions: type it, post a typical one by hand, or scan a page. */
export function AddTransaction() {
  return (
    <div>
      <PageHeader title="Add a transaction" subtitle="Type it in plain English or scan a page. Quick post is on the Journal. Everything lands in the journal and updates every report." />
      <Card className="space-y-6 p-5">
        <div>
          <div className="text-base font-semibold text-slate-900">Describe it</div>
          <p className="mb-3 text-sm text-slate-500">Type it in plain English, like “Bought a car for 4000”, and check the entry before it’s saved.</p>
          <TransactionComposer showManualLink={false} />
        </div>
        <div className="border-t border-slate-400/25 pt-5">
          <ScanPage />
        </div>
      </Card>
      <p className="mt-4 text-sm text-slate-500">
        See everything you've posted in the{' '}
        <Link to="/journal" className="font-semibold text-cyan-700 hover:underline">
          Journal
        </Link>
        .
      </p>
    </div>
  );
}
