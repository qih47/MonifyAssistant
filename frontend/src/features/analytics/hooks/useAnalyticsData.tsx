import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

export interface AnalyticsData {
  categoryPieData: { name: string; value: number; percentage: number }[];
  monthlyTrendData: { month: string; income: number; expense: number }[];
  topExpenses: {
    id: string;
    description: string;
    amount: number;
    category: string;
    pocket_name: string;
    created_at: string;
  }[];
  comparison: {
    currentMonthExpense: number;
    lastMonthExpense: number;
    percentageChange: number; // Positif berarti naik, negatif berarti turun
    isHigher: boolean;
  };
}

export const useAnalyticsData = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    categoryPieData: [],
    monthlyTrendData: [],
    topExpenses: [],
    comparison: {
      currentMonthExpense: 0,
      lastMonthExpense: 0,
      percentageChange: 0,
      isHigher: false,
    },
  });
  const [loading, setLoading] = useState(true);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      const now = new Date();
      
      // Ambil range awal bulan ini & bulan lalu untuk komparasi dan pie chart
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      // Range 12 bulan terakhir untuk Line Chart Tren
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

      // 1. Ambil seluruh transaksi 12 bulan terakhir untuk line chart & komparasi
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('id, type, amount, description, category, created_at, pockets(display_name)')
        .gte('created_at', twelveMonthsAgo)
        .order('created_at', { ascending: true });

      if (txError) throw txError;

      const safeTx = transactions || [];

      // ==========================================
      // FITUR 2.1: AREA KALKULASI CATEGORY PIE CHART & SPENDING COMPARISON
      // ==========================================
      let currentMonthExpenseSum = 0;
      let lastMonthExpenseSum = 0;
      const categoryMap: Record<string, number> = {};

      safeTx.forEach((tx: any) => {
        const amount = Number(tx.amount || 0);

        if (tx.type === 'expense') {
          // Filter untuk bulan ini saja
          if (tx.created_at >= startOfCurrentMonth) {
            currentMonthExpenseSum += amount;

            // Mapping Kategori untuk Pie Chart
            const catName = tx.category ? tx.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Lainnya';
            categoryMap[catName] = (categoryMap[catName] || 0) + amount;
          }
          // Filter untuk bulan lalu saja
          else if (tx.created_at >= startOfLastMonth && tx.created_at <= endOfLastMonth) {
            lastMonthExpenseSum += amount;
          }
        }
      });

      // Format data untuk Recharts Pie
      const pieData = Object.keys(categoryMap).map((cat) => {
        const val = categoryMap[cat];
        return {
          name: cat,
          value: val,
          percentage: currentMonthExpenseSum > 0 ? Math.round((val / currentMonthExpenseSum) * 100) : 0,
        };
      }).sort((a, b) => b.value - a.value);

      // Hitung persentase kenaikan/penurunan pengeluaran (% change)
      let percentChange = 0;
      if (lastMonthExpenseSum > 0) {
        percentChange = Number(((currentMonthExpenseSum - lastMonthExpenseSum) / lastMonthExpenseSum * 100).toFixed(1));
      } else if (currentMonthExpenseSum > 0) {
        percentChange = 100; // Jika bulan lalu kosong dan bulan ini ada pengeluaran
      }

      // ==========================================
      // FITUR 2.2: AREA KALKULASI MONTHLY TREND LINE CHART (12 BULAN)
      // ==========================================
      const trendMap: Record<string, { month: string; income: number; expense: number }> = {};
      
      // Generate urutan 12 bulan terakhir agar chart tidak kosong jika ada bulan tanpa transaksi
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
        trendMap[monthKey] = { month: monthKey, income: 0, expense: 0 };
      }

      safeTx.forEach((tx: any) => {
        const txDate = new Date(tx.created_at);
        const monthKey = txDate.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
        const amount = Number(tx.amount || 0);

        if (trendMap[monthKey]) {
          if (tx.type === 'income') trendMap[monthKey].income += amount;
          else if (tx.type === 'expense') trendMap[monthKey].expense += amount;
        }
      });

      const trendData = Object.values(trendMap);

      // ==========================================
      // FITUR 2.3: TOP 5 EXPENSES WIDGET
      // ==========================================
      const topExpensesData = safeTx
        .filter((tx: any) => tx.type === 'expense' && tx.created_at >= startOfCurrentMonth)
        .sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 5)
        .map((tx: any) => ({
          id: tx.id,
          description: tx.description,
          amount: Number(tx.amount || 0),
          category: tx.category ? tx.category.replace(/_/g, ' ') : 'lainnya',
          pocket_name: tx.pockets?.display_name || 'Tanpa Kantong',
          created_at: tx.created_at,
        }));

      setAnalytics({
        categoryPieData: pieData,
        monthlyTrendData: trendData,
        topExpenses: topExpensesData,
        comparison: {
          currentMonthExpense: currentMonthExpenseSum,
          lastMonthExpense: lastMonthExpenseSum,
          percentageChange: percentChange,
          isHigher: currentMonthExpenseSum >= lastMonthExpenseSum,
        },
      });
    } catch (err) {
      console.error('Error compiling analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  return { analytics, loading, refreshAnalytics: fetchAnalyticsData };
};