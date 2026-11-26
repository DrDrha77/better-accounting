import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Layout, useStartPath } from './components/Layout';
import { Splash } from './components/Splash';
import { ErrorBoundary } from './components/ErrorBoundary';
import { bootstrapCompanies } from './store/companyActions';
import './index.css';
import { BalanceSheet } from './pages/BalanceSheet';
import { IncomeStatement } from './pages/IncomeStatement';
import { AddTransaction } from './pages/AddTransaction';
import { Home } from './pages/Home';
import { Journal } from './pages/Journal';
import { Ledger } from './pages/Ledger';
import { Settings } from './pages/Settings';
import { TAccounts } from './pages/TAccounts';
import { OwnersEquity } from './pages/OwnersEquity';
import { Worksheet } from './pages/Worksheet';
import { TrialBalance } from './pages/TrialBalance';

// Make sure the company registry exists and the active company's data is saved under its own keys.
bootstrapCompanies();

function StartRedirect() {
  return <Navigate to={useStartPath()} replace />;
}

// Hash routing so the built app works from any static host without server rewrites.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <StartRedirect /> },
      { path: '/home', element: <Home /> },
      { path: '/add', element: <AddTransaction /> },
      { path: '/journal', element: <Journal /> },
      { path: '/ledger', element: <Ledger /> },
      { path: '/t-accounts', element: <TAccounts /> },
      { path: '/trial-balance', element: <TrialBalance /> },
      { path: '/worksheet', element: <Worksheet /> },
      { path: '/owners-equity', element: <OwnersEquity /> },
      { path: '/balance-sheet', element: <BalanceSheet /> },
      { path: '/income-statement', element: <IncomeStatement /> },
      { path: '/settings', element: <Settings /> },
      // Opening balances now live in Settings.
      { path: '/opening-balances', element: <Navigate to="/settings" state={{ scrollTo: 'opening-balances' }} replace /> },
      // Pages that moved into Settings.
      { path: '/accounts', element: <Navigate to="/settings" replace /> },
      { path: '/opening-statement', element: <Navigate to="/settings" replace /> },
      { path: '*', element: <Navigate to="/add" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Splash />
    </ErrorBoundary>
  </StrictMode>,
);
