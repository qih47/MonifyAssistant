import React from 'react';
import { formatIDR } from '../../../lib/formatter';
import { ArrowUpRight, Calendar, ShoppingBag } from 'lucide-react';

interface TopExpensesWidgetProps {
  data: {
    id: string;
    description: string;
    amount: number;
    category: string;
    pocket_name: string;
    created_at: string;
  }[];
}

export const TopExpensesWidget: React.FC<TopExpensesWidgetProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800/60 h-full flex flex-col items-center justify-center min-h-[300px] text-slate-400">
        <p className="text-sm font-medium">Belum ada catatan pengeluaran besar bulan ini, Cuy. Aman!</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800/60 flex flex-col justify-between h-full">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Top 5 Pengeluaran Terbesar
        </h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Daftar 5 transaksi paling boros yang memotong kantong dana bulan ini.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <th className="pb-3 font-bold">Transaksi</th>
              <th className="pb-3 font-bold">Kantong</th>
              <th className="pb-3 font-bold text-right">Nominal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-xs font-bold text-slate-700 dark:text-slate-300">
            {data.map((item) => {
              const dateText = new Date(item.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
              });

              return (
                <tr key={item.id} className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 pr-2 max-w-[160px] md:max-w-[200px]">
                    <div className="flex flex-col gap-1 truncate">
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-500 transition-colors">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 capitalize dark:bg-slate-800 dark:text-slate-400">
                          {item.category.replace('_', ' ')}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Calendar size={10} />
                          {dateText}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-slate-500 dark:text-slate-400 font-medium truncate max-w-[100px]">
                    {item.pocket_name}
                  </td>
                  <td className="py-3.5 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    -{formatIDR(item.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};