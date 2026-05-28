import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { OverviewPage } from '../features/dashboard/pages/OverviewPage';
import { AssetsPage } from '../features/assets/pages/AssetsPage';
import { PocketsPage } from '../features/pockets/pages/PocketsPage';
import { TransactionsPage } from '../features/transactions/pages/TransactionsPage';
import { BillsPage } from '../features/bills/pages/BillsPage';

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Memasukkan semua halaman ke dalam bungkus DashboardLayout */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/pockets" element={<PocketsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/bills" element={<BillsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};