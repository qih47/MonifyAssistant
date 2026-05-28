import React from 'react';
import { Link } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData';
import { formatIDR } from '../../../lib/formatter';
import { formatDateIndo } from '../../../lib/dateFormatter';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  Loader2, 
  ShieldCheck, 
  Wallet, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Calendar, 
  TrendingUp, 
  CheckCircle,
  PiggyBank,
  ArrowRight,
  User,
  Users
} from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'];

export const OverviewPage = () => {
  const { summary, loading, refreshDashboard } = useDashboardData();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400 dark:text-slate-500">
        <Loader2 className="animate-spin mb-4 text-slate-800 dark:text-slate-200" size={40} />
        <p className="text-sm font-semibold tracking-wide">Menghitung kalkulasi finansial real-time...</p>
      </div>
    );
  }

  const savingRate = summary.totalIncome > 0 
    ? Math.round(((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100)
    : 0;

  const getSavingRateColor = (rate: number) => {
    if (rate >= 30) return 'bg-emerald-500';
    if (rate >= 10) return 'bg-blue-500';
    if (rate > 0) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getActorBadge = (actor: string) => {
    if (actor === 'istri') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 bg-pink-50 border border-pink-100 text-pink-600 rounded dark:bg-pink-950/30 dark:border-pink-900/50 dark:text-pink-400 font-mono">
          Gita
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 bg-blue-50 border border-blue-100 text-blue-600 rounded dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400 font-mono">
        Qisthi
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HEADER DASHBOARD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
        <div>
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Ringkasan Keuangan Keluarga</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Arsitektur kendali finansial dinamis terpusat.</p>
        </div>
        <button
          onClick={refreshDashboard}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 shadow-sm self-start sm:self-auto font-semibold text-xs"
          title="Refresh Data"
        >
          <RefreshCw size={14} className="animate-hover-spin" />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* KUMPULAN KARTU INFORMASI UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD NET WORTH */}
        <div className="group relative p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800/80 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/10 hover:-translate-y-1 overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Kekayaan Bersih (Net Worth)</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <ShieldCheck size={18} className="stroke-[2.5]" />
              </div>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">{formatIDR(summary.netWorth)}</h2>
          </div>
          
          <div className="mt-4 border-t border-slate-800/80 pt-3 space-y-1 text-[11px] text-slate-400 font-medium">
            <div className="flex justify-between">
              <span>👪 Harta Bersama:</span>
              <span className="text-white font-semibold">{formatIDR(summary.sharedNetWorth)}</span>
            </div>
            <div className="flex justify-between">
              <span>🧑 Harta Qisthi:</span>
              <span className="text-blue-400 font-semibold">{formatIDR(summary.suamiNetWorth)}</span>
            </div>
            <div className="flex justify-between">
              <span>👩 Harta Gita:</span>
              <span className="text-pink-400 font-semibold">{formatIDR(summary.istriNetWorth)}</span>
            </div>
          </div>
        </div>

        {/* CARD POCKETS */}
        <div className="group relative p-6 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-500" />
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Dana di Kantong</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 rounded-xl">
                <Wallet size={18} className="stroke-[2.5]" />
              </div>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">{formatIDR(summary.totalPocketsBalance)}</h2>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-5 border-t border-slate-50 dark:border-slate-800/20 pt-3 leading-relaxed">
            Total dana siap pakai di pos operasional bulanan.
          </p>
        </div>

        {/* CARD BILLS */}
        <div className="group relative p-6 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all duration-500" />
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tagihan Belum Dibayar</span>
              <div className={`p-2 rounded-xl ${summary.unpaidBillsCount > 0 ? "bg-rose-50 dark:bg-rose-950/40 text-rose-500" : "bg-slate-50 dark:bg-slate-800 text-slate-400"}`}>
                <AlertCircle size={18} className={`stroke-[2.5] ${summary.unpaidBillsCount > 0 ? "animate-pulse" : ""}`} />
              </div>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
              {formatIDR(summary.unpaidBillsAmount)}
            </h2>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-5 border-t border-slate-50 dark:border-slate-800/20 pt-3 flex justify-between items-center">
            <span>Status pengingat bulanan:</span>
            <span className={`font-bold px-2 py-0.5 rounded-lg text-[10px] ${summary.unpaidBillsCount > 0 ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"}`}>
              {summary.unpaidBillsCount > 0 ? `${summary.unpaidBillsCount} Tagihan` : 'Semua Lunas'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── FITUR PREMIUM BARU: PANEL BREAKDOWN SALDO KANTONG BERJALAN LENGKAP ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* SALDO BERSAMA OPERASIONAL */}
        <div className="p-4 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Kantong Bersama (Utama)</p>
            <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight">{formatIDR(summary.sharedPocketsBalance)}</h4>
          </div>
        </div>

        {/* SALDO PEGANGAN PRIBADI QISTHI */}
        <div className="p-4 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400 rounded-xl">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Jatah Kantong Qisthi</p>
            <h4 className="text-base font-black text-blue-600 dark:text-blue-400 tracking-tight">{formatIDR(summary.suamiPocketsBalance)}</h4>
          </div>
        </div>

        {/* SALDO PEGANGAN PRIBADI GITA */}
        <div className="p-4 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-pink-50 dark:bg-pink-950/30 text-pink-500 dark:text-pink-400 rounded-xl">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Jatah Kantong Gita</p>
            <h4 className="text-base font-black text-pink-600 dark:text-pink-400 tracking-tight">{formatIDR(summary.istriPocketsBalance)}</h4>
          </div>
        </div>
      </div>
      {/* ───────────────────────────────────────────────────────────────────────── */}

      {/* MODUL ARUS KAS KELUARGA (CASH FLOW ANALYSIS) */}
      <div className="p-6 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <PiggyBank size={18} className="text-emerald-500" />
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 tracking-tight uppercase">Analisis Arus Kas Bulan Ini</h4>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PEMASUKAN */}
          <div className="p-4 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100/40 dark:border-emerald-900/20 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Pemasukan</p>
              <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">+{formatIDR(summary.totalIncome)}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <ArrowUpRight size={22} className="stroke-[2.5]" />
            </div>
          </div>

          {/* PENGELUARAN */}
          <div className="p-4 bg-rose-50/20 dark:bg-rose-950/10 border border-rose-100/40 dark:border-rose-900/20 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Pengeluaran</p>
              <h3 className="text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">-{formatIDR(summary.totalExpense)}</h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
              <ArrowDownLeft size={22} className="stroke-[2.5]" />
            </div>
          </div>

          {/* SAVING RATE / GAUGE */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40 rounded-xl flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rasio Tabungan (Saving Rate)</span>
              <span className={`font-mono text-xs font-black ${savingRate >= 30 ? 'text-emerald-500' : savingRate > 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                {savingRate}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${getSavingRateColor(savingRate)}`} 
                style={{ width: `${Math.min(Math.max(savingRate, 0), 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-none font-semibold">
              {savingRate >= 30 
                ? 'Sangat Sehat! Kemampuan menabung di atas target minimal 30%.' 
                : savingRate > 0 
                ? 'Cukup Sehat. Coba alokasikan lebih banyak ke tabungan aset.'
                : 'Peringatan! Pengeluaran melebihi pemasukan bulan ini.'}
            </p>
          </div>
        </div>
      </div>

      {/* CHART DIAGRAM & UPCOMING BILLS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART RECHARTS ALOKASI ASET */}
        <div className="p-6 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-slate-500" />
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Komposisi Alokasi Aset Harta</h4>
          </div>
          <div className="w-full h-64 flex items-center justify-center">
            {summary.chartData.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">Belum ada data aset untuk dirender grafik.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {summary.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatIDR(Number(value))}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* METRIK KANTONG DANA VS TAGIHAN / UPCOMING BILLS */}
        <div className="p-6 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-500" />
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Tagihan Terdekat</h4>
            </div>
            <span className="text-[10px] bg-slate-50 dark:bg-slate-800 font-bold px-2 py-0.5 rounded text-slate-500 dark:text-slate-400">Jatuh Tempo Terdekat</span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {summary.upcomingBills.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center justify-center">
                <CheckCircle size={32} className="text-emerald-500 mb-2" />
                <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300">Semua Tagihan Aman</h5>
                <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1 leading-normal">
                  Tidak ada tagihan tertunggak bulan ini. Dompet keluarga dalam keadaan aman terkendali!
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 my-2">
                {summary.upcomingBills.map((bill) => (
                  <div 
                    key={bill.id}
                    className="p-3.5 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-800/10 dark:hover:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40 rounded-xl flex items-center justify-between transition-all duration-200"
                  >
                    <div className="space-y-1">
                      <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">{bill.name}</h5>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        <span>Sumber: <strong className="text-slate-500 dark:text-slate-400">{bill.pocket_name}</strong></span>
                        <span>•</span>
                        <span className="text-rose-500 font-bold font-mono">Tiap Tanggal {bill.due_date}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-black text-slate-900 dark:text-white">{formatIDR(bill.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-50 dark:border-slate-800/20 pt-4 mt-2 flex justify-end">
            <Link 
              to="/bills" 
              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-wider"
            >
              <span>Urus Semua Tagihan</span>
              <ArrowRight size={12} className="stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </div>

      {/* 5 TRANSAKSI TERAKHIR */}
      <div className="p-6 bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Mutasi Transaksi Terkini</h4>
          <Link 
            to="/transactions" 
            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-wider"
          >
            <span>Semua Transaksi</span>
            <ArrowRight size={12} className="stroke-[2.5]" />
          </Link>
        </div>

        {summary.recentTransactions.length === 0 ? (
          <p className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">Belum ada jejak mutasi keuangan.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-50 dark:border-slate-800/40">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 dark:bg-slate-850/40 dark:border-slate-800/60 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Deskripsi</th>
                  <th className="py-3 px-4">Eksekutor</th>
                  <th className="py-3 px-4">Alokasi Kantong</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-sm">
                {summary.recentTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="py-3 px-4 text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap">
                        {formatDateIndo(tx.created_at)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        {tx.description}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getActorBadge(tx.actor)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-400 whitespace-nowrap">
                          {tx.pocket_name}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-black font-mono whitespace-nowrap ${isExpense ? 'text-rose-500' : 'text-emerald-500'}`}>
                        <span className="inline-flex items-center gap-0.5">
                          {isExpense ? <ArrowUpRight size={12} className="stroke-[2.5]" /> : <ArrowDownLeft size={12} className="stroke-[2.5]" />}
                          {isExpense ? '-' : '+'}{formatIDR(tx.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};