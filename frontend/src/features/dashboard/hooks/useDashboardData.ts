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
  const goldPrice = 1450000; // Harga buyback emas per gram (Rp)

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Tarik Data Aset (Harta Diam/Tabungan Induk)
      const { data: assets, error: assetErr } = await supabase.from('assets').select('*');
      if (assetErr) throw assetErr;

      // 2. Tarik Data Kantong (Uang Berjalan/Siap Pakai)
      const { data: pockets, error: pocketErr } = await supabase.from('pockets').select('*');
      if (pocketErr) throw pocketErr;

      // 3. Tarik Data Tagihan
      const { data: bills, error: billErr } = await supabase.from('bills').select('*');
      if (billErr) throw billErr;

      // 4. Tarik list pockets terpisah untuk mapping nama relasi secara lokal agar aman dari crash join
      const pocketMapIndexed: Record<number, string> = {};
      (pockets || []).forEach((p: any) => {
        pocketMapIndexed[p.id] = p.display_name || p.name || 'Tanpa Kantong';
      });
      
      // 5. Tarik 5 Transaksi Terakhir untuk Mutasi
      const { data: transactions, error: txLimitErr } = await supabase
        .from('transactions')
        .select('id, type, amount, description, created_at, actor, pocket_id')
        .order('created_at', { ascending: false })
        .limit(5);
      if (txLimitErr) throw txLimitErr;

      // 6. Tarik seluruh transaksi bulan ini untuk kalkulasi total cashflow harian
      const { data: allTransactions, error: txAllErr } = await supabase
        .from('transactions')
        .select('type, amount');
      if (txAllErr) throw txAllErr;

      // ==========================================
      // AREA KALKULASI AGREGASI ASET (NET WORTH)
      // ==========================================
      let totalRupiahAset = 0;
      let sharedAssetSum = 0;
      let suamiAssetSum = 0;
      let istriAssetSum = 0;
      const assetChartData: { name: string; value: number }[] = [];

      (assets || []).forEach((asset: any) => {
        const value = asset.category?.toLowerCase() === 'emas' 
          ? Number(asset.gold_weight_gram || 0) * goldPrice 
          : Number(asset.balance || 0);
        
        totalRupiahAset += value;

        const owner = (asset.ownership || 'bersama').toLowerCase();
        if (owner === 'suami' || owner === 'qisthi') suamiAssetSum += value;
        else if (owner === 'istri' || owner === 'gita') istriAssetSum += value;
        else sharedAssetSum += value;

        assetChartData.push({ name: asset.name, value });
      });

      // ==========================================
      // AREA KALKULASI AGREGASI KANTONG DANA (POCKETS)
      // ==========================================
      let totalPockets = 0;
      let sharedPocketSum = 0;
      let suamiPocketSum = 0;
      let istriPocketSum = 0;

      (pockets || []).forEach((p: any) => {
        const balance = Number(p.current_balance || 0);
        totalPockets += balance;

        const owner = (p.ownership || 'bersama').toLowerCase();
        if (owner === 'suami' || owner === 'qisthi') suamiPocketSum += balance;
        else if (owner === 'istri' || owner === 'gita') istriPocketSum += balance;
        else sharedPocketSum += balance;
      });
      
      // ==========================================
      // AREA KALKULASI TAGIHAN (BILLS)
      // ==========================================
      const unpaid = (bills || []).filter((b) => b.status !== 'paid');
      const unpaidCount = unpaid.length;
      const unpaidAmount = unpaid.reduce((sum, b) => sum + Number(b.amount || 0), 0);

      // Urutkan 3 tagihan terdekat berdasarkan tanggal jatuh tempo terawal
      const mappedUpcoming = unpaid.map((b: any) => ({
        id: Number(b.id),
        name: b.name,
        amount: Number(b.amount || 0),
        due_date: Number(b.due_date || 1),
        pocket_name: pocketMapIndexed[b.pocket_id] || 'Tanpa Kantong'
      })).sort((x, y) => x.due_date - y.due_date).slice(0, 3);

      // ==========================================
      // AREA KALKULASI ARUS KAS (CASH FLOW)
      // ==========================================
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
          pocket_name: pocketMapIndexed[row.pocket_id] || 'Tanpa Kantong'
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