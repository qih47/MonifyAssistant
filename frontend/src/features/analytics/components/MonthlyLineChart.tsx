import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatIDR } from '../../../lib/formatter';

interface MonthlyLineChartProps {
  data: { month: string; income: number; expense: number }[];
}

// Custom Tooltip premium biar detail nominal pas hover chart kelihatan rapi
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1.5">
        <p className="font-bold text-slate-400 border-b border-slate-800 pb-1">
          Periode: {payload[0].payload.month}
        </p>
        <p className="font-medium text-emerald-400">
          🟢 Pemasukan: <span className="font-black">{formatIDR(payload[0].value)}</span>
        </p>
        <p className="font-medium text-rose-400">
          🔴 Pengeluaran: <span className="font-black">{formatIDR(payload[1].value)}</span>
        </p>
        <p className="font-medium text-slate-200 border-t border-slate-800 pt-1">
          📈 Net Cashflow: <span className="font-black">{formatIDR(payload[0].value - payload[1].value)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const MonthlyLineChart: React.FC<MonthlyLineChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[320px] text-slate-400">
        <p className="text-sm font-medium">Data transaksi historis tidak ditemukan, Cuy.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800/60 flex flex-col justify-between h-full">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Tren Arus Kas (12 Bulan Terakhir)
        </h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Bandingkan naik-turunnya stabilitas pemasukan vs pengeluaran bulanan lu.
        </p>
      </div>

      <div className="w-full h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800/50" vertical={false} />
            <XAxis 
              dataKey="month" 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v.toLocaleString('id-ID')}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              iconType="circle" 
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '10px' }}
            />
            <Line 
              name="Pemasukan" 
              type="monotone" 
              dataKey="income" 
              stroke="#10b981" 
              strokeWidth={3}
              dot={{ r: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line 
              name="Pengeluaran" 
              type="monotone" 
              dataKey="expense" 
              stroke="#f43f5e" 
              strokeWidth={3}
              dot={{ r: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};