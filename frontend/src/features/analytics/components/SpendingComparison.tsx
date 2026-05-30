import React from 'react';
import { formatIDR } from '../../../lib/formatter';
import { TrendingUp, TrendingDown, ArrowRightLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface SpendingComparisonProps {
  comparison: {
    currentMonthExpense: number;
    lastMonthExpense: number;
    percentageChange: number;
    isHigher: boolean;
  };
}

export const SpendingComparison: React.FC<SpendingComparisonProps> = ({ comparison }) => {
  const { currentMonthExpense, lastMonthExpense, percentageChange, isHigher } = comparison;

  // Render teks insight dinamis berdasarkan kondisi keuangan bulanan
  const getInsightMessage = () => {
    if (currentMonthExpense === 0) return 'Belum ada pengeluaran tercatat bulan ini, Cuy. Dompet aman!';
    if (lastMonthExpense === 0) return 'Data pengeluaran bulan lalu kosong, belum bisa bandingin tren, Cuy.';
    
    if (isHigher) {
      if (percentageChange > 20) {
        return 'Waduh Cuy, pengeluaran lu melonjak tajam dibanding bulan lalu! Coba rem dikit pos jajan harian lu berdua. 🚨';
      }
      return 'Pengeluaran bulan ini sedikit lebih tinggi dari bulan lalu, Cuy. Jaga ritme biar gak boncos di akhir bulan.';
    } else {
      if (percentageChange > 20) {
        return 'Gokil, Cuy! Lu berdua hemat banget bulan ini dibanding bulan kemarin. Pertahankan manajemen mantap ini! 🏆';
      }
      return 'Mantap, ritme belanja lu berdua lebih terkontrol dan lebih hemat dibanding bulan lalu. Aman sentosa!';
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800/60 flex flex-col justify-between h-full">
      <div>
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Analisis Komparasi Belanja
        </h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Perbandingan performa total pengeluaran bulan ini vs bulan lalu.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 my-4">
        <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100/50 dark:bg-slate-800/20 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bulan Lalu</p>
          <p className="text-base font-black text-slate-700 dark:text-slate-300 mt-0.5 whitespace-nowrap">
            {formatIDR(lastMonthExpense)}
          </p>
        </div>
        <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-100/50 dark:bg-slate-800/20 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bulan Ini</p>
          <p className="text-base font-black text-slate-950 dark:text-white mt-0.5 whitespace-nowrap">
            {formatIDR(currentMonthExpense)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* BADGE STATISTIK INDIKATOR PERUBAHAN */}
        {lastMonthExpense > 0 && (
          <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${
            isHigher 
              ? 'bg-rose-50/50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400' 
              : 'bg-emerald-50/50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
          }`}>
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${isHigher ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
              {isHigher ? <TrendingUp size={14} className="stroke-[3]" /> : <TrendingDown size={14} className="stroke-[3]" />}
            </div>
            <div className="text-xs font-bold leading-tight">
              <span className="font-black text-sm">{Math.abs(percentageChange)}%</span>{' '}
              {isHigher ? 'lebih boros' : 'lebih hemat'} dibanding bulan lalu
            </div>
          </div>
        )}

        {/* FEEDBACK INSIGHT TEXT CARD */}
        <div className={`flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-800/40 dark:border-slate-800/80 dark:text-slate-400`}>
          <div className="mt-0.5 flex-shrink-0">
            {isHigher && currentMonthExpense > lastMonthExpense ? (
              <ShieldAlert size={14} className="text-amber-500 stroke-[2.5]" />
            ) : (
              <CheckCircle2 size={14} className="text-emerald-500 stroke-[2.5]" />
            )}
          </div>
          <p className="font-medium leading-relaxed">{getInsightMessage()}</p>
        </div>
      </div>
    </div>
  );
};