import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { OverviewPage } from '../features/dashboard/pages/OverviewPage';
import { AssetsPage } from '../features/assets/pages/AssetsPage';
import { PocketsPage } from '../features/pockets/pages/PocketsPage';
import { TransactionsPage } from '../features/transactions/pages/TransactionsPage';
import { BillsPage } from '../features/bills/pages/BillsPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Route - Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes - Harus Login Dulu */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<OverviewPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/pockets" element={<PocketsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/bills" element={<BillsPage />} />
      </Route>

      {/* Fallback - Redirect ke Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};