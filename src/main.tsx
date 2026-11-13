import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import './index.css';
import { BalanceSheet } from './pages/BalanceSheet';
import { IncomeStatement } from './pages/IncomeStatement';
import { Journal } from './pages/Journal';
import { Ledger } from './pages/Ledger';
import { OpeningBalances } from './pages/OpeningBalances';
import { Settings } from './pages/Settings';
import { TAccounts } from './pages/TAccounts';
import { TrialBalance } from './pages/TrialBalance';

// Hash routing so the built app works from any static host without server rewrites.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Navigate to="/journal" replace /> },
      { path: '/journal', element: <Journal /> },
      { path: '/ledger', element: <Ledger /> },
      { path: '/t-accounts', element: <TAccounts /> },
      { path: '/trial-balance', element: <TrialBalance /> },
      { path: '/balance-sheet', element: <BalanceSheet /> },
      { path: '/income-statement', element: <IncomeStatement /> },
      { path: '/settings', element: <Settings /> },
      // Reached from the Journal's "Opening balances" button.
      { path: '/opening-balances', element: <OpeningBalances /> },
      // Pages that moved into Settings.
      { path: '/accounts', element: <Navigate to="/settings" replace /> },
      { path: '/opening-statement', element: <Navigate to="/settings" replace /> },
      { path: '*', element: <Navigate to="/journal" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
