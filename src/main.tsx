import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { bootstrapCompanies } from './store/companyActions';
import './index.css';
import { BalanceSheet } from './pages/BalanceSheet';
import { IncomeStatement } from './pages/IncomeStatement';
import { Journal } from './pages/Journal';
import { Ledger } from './pages/Ledger';
import { Settings } from './pages/Settings';
import { TAccounts } from './pages/TAccounts';
import { TrialBalance } from './pages/TrialBalance';

// Make sure the company registry exists and the active company's data is saved under its own keys.
bootstrapCompanies();

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
      // Opening balances now live in Settings.
      { path: '/opening-balances', element: <Navigate to="/settings" state={{ scrollTo: 'opening-balances' }} replace /> },
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
