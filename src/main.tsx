import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import './index.css';
import { BalanceSheet } from './pages/BalanceSheet';
import { ChartOfAccounts } from './pages/ChartOfAccounts';
import { Dashboard } from './pages/Dashboard';
import { IncomeStatement } from './pages/IncomeStatement';
import { Journal } from './pages/Journal';
import { Ledger } from './pages/Ledger';
import { OpeningBalances } from './pages/OpeningBalances';
import { OpeningStatement } from './pages/OpeningStatement';
import { OwnersEquity } from './pages/OwnersEquity';
import { TAccounts } from './pages/TAccounts';
import { TrialBalance } from './pages/TrialBalance';

// Hash routing so the built app works from any static host without server rewrites.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/journal', element: <Journal /> },
      { path: '/ledger', element: <Ledger /> },
      { path: '/t-accounts', element: <TAccounts /> },
      { path: '/trial-balance', element: <TrialBalance /> },
      { path: '/income-statement', element: <IncomeStatement /> },
      { path: '/balance-sheet', element: <BalanceSheet /> },
      { path: '/owners-equity', element: <OwnersEquity /> },
      { path: '/opening-statement', element: <OpeningStatement /> },
      { path: '/opening-balances', element: <OpeningBalances /> },
      { path: '/accounts', element: <ChartOfAccounts /> },
      { path: '*', element: <Dashboard /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
