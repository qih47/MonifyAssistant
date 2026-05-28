import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

export interface DashboardSummary {
  netWorth: number;
  totalPocketsBalance: number;
  unpaidBillsCount: number;
  unpaidBillsAmount: number;
  totalIncome: number;
  totalExpense: number;
  upcomingBills: {
    id: number;
    name: string;
    amount: number;
    due_date: number;
    pocket_name: string;
  }[];
  chartData: { name: string; value: number }[];
  recentTransactions: any[];
  sharedNetWorth: number;
  suamiNetWorth: number;
  istriNetWorth: number;
  // ─── AGREGASI SALDO KANTONG (POCKETS) BARU ───
  sharedPocketsBalance: number;
  suamiPocketsBalance: number;
  istriPocketsBalance: number;
}

export const useDashboardData = () => {
  const [summary, setSummary] = useState<DashboardSummary>({
    netWorth: 0,
    totalPocketsBalance: 0,
    unpaidBillsCount: 0,
    unpaidBillsAmount: 0,
    totalIncome: 0,
    totalExpense: 0,
    upcomingBills: [],
    chartData: [],
    recentTransactions: [],
    sharedNetWorth: 0,
    suamiNetWorth: 0,
    istriNetWorth: 0,
    sharedPocketsBalance: 0,
    suamiPocketsBalance: 0,
    istriPocketsBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const goldPrice = 1450000; // Harga buyback default per gram (Rp)

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Tarik Data Aset
      const { data: assets } = await supabase.from('assets').select('*');
      // 2. Tarik Data Kantong
      const { data: pockets } = await supabase.from('pockets').select('*');
      // 3. Tarik Data Tagihan dengan join pockets
      const { data: bills } = await supabase
        .from('bills')
        .select('id, name, amount, due_date, status, pocket_id, pockets(display_name)');
      
      // 4. Tarik 5 Transaksi Terakhir
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, type, amount, description, created_at, actor, pockets(display_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      // 5. Tarik seluruh transaksi untuk kalkulasi cashflow
      const { data: allTransactions } = await supabase
        .from('transactions')
        .select('type, amount');

      // Perhitungan Agregasi Aset (Harta Diam/Tabungan Induk)
      let totalRupiahAset = 0;
      let sharedAssetSum = 0;
      let suamiAssetSum = 0;
      let istriAssetSum = 0;
      let assetChartData: { name: string; value: number }[] = [];

      (assets || []).forEach((asset: any) => {
        const value = asset.category.toLowerCase() === 'emas' 
          ? Number(asset.gold_weight_gram || 0) * goldPrice 
          : Number(asset.balance || 0);
        
        totalRupiahAset += value;

        const owner = (asset.ownership || 'bersama').toLowerCase();
        if (owner === 'suami') suamiAssetSum += value;
        else if (owner === 'istri') istriAssetSum += value;
        else sharedAssetSum += value;

        assetChartData.push({ name: asset.name, value });
      });

      // Perhitungan Agregasi Kantong Dana (Uang Berjalan/Siap Pakai)
      let totalPockets = 0;
      let sharedPocketSum = 0;
      let suamiPocketSum = 0;
      let istriPocketSum = 0;

      (pockets || []).forEach((p: any) => {
        const balance = Number(p.current_balance || 0);
        totalPockets += balance;

        const owner = (p.ownership || 'bersama').toLowerCase();
        if (owner === 'suami') suamiPocketSum += balance;
        else if (owner === 'istri') istriPocketSum += balance;
        else sharedPocketSum += balance;
      });
      
      // Hitung tagihan
      const unpaid = (bills || []).filter((b) => b.status !== 'paid');
      const unpaidCount = unpaid.length;
      const unpaidAmount = unpaid.reduce((sum, b) => sum + Number(b.amount || 0), 0);

      // Hitung tagihan mendatang terdekat
      const mappedUpcoming = unpaid.map((b: any) => ({
        id: Number(b.id),
        name: b.name,
        amount: Number(b.amount || 0),
        due_date: Number(b.due_date || 1),
        pocket_name: b.pockets?.display_name || 'Tanpa Kantong'
      })).sort((x, y) => x.due_date - y.due_date)
      .slice(0, 3);

      // Hitung Cash Flow
      let incomeSum = 0;
      let expenseSum = 0;
      (allTransactions || []).forEach((tx: any) => {
        if (tx.type === 'income') incomeSum += Number(tx.amount || 0);
        else if (tx.type === 'expense') expenseSum += Number(tx.amount || 0);
      });

      setSummary({
        netWorth: totalRupiahAset,
        totalPocketsBalance: totalPockets,
        unpaidBillsCount: unpaidCount,
        unpaidBillsAmount: unpaidAmount,
        totalIncome: incomeSum,
        totalExpense: expenseSum,
        upcomingBills: mappedUpcoming,
        chartData: assetChartData,
        sharedNetWorth: sharedAssetSum,
        suamiNetWorth: suamiAssetSum,
        istriNetWorth: istriAssetSum,
        sharedPocketsBalance: sharedPocketSum,
        suamiPocketsBalance: suamiPocketSum,
        istriPocketsBalance: istriPocketSum,
        recentTransactions: (transactions || []).map((row: any) => ({
          id: row.id,
          type: row.type,
          amount: Number(row.amount || 0),
          description: row.description,
          created_at: row.created_at,
          actor: row.actor || 'suami',
          pocket_name: row.pockets?.display_name || 'Tanpa Kantong'
        })),
      });
    } catch (err) {
      console.error('Error compiling dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return { summary, loading, refreshDashboard: fetchDashboardData };
};