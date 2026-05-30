import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatIDR } from '../../../lib/formatter';

interface CategoryPieChartProps {
  data: { name: string; value: number; percentage: number }[];
}

// Palet warna estetik premium untuk tiap sektor kategori pengeluaran
const COLORS = [
  '#0ea5e9', // Sky (Makanan & Minuman)
  '#f43f5e', // Rose (Keperluan Bayi)
  '#6366f1', // Indigo (Tagihan Rutin)
  '#10b981', // Emerald (Transportasi)
  '#f59e0b', // Amber (Jajan & Hiburan)
  '#8b5cf6', // Violet (Elektronik)
  '#ec4899', // Pink (Sandang)
  '#14b8a6', // Teal (Investasi & Tabungan)
  '#64748b', // Slate (Lainnya)
];

// Custom Tooltip biar hover chart-nya cakep dan informatif
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
        <p className="font-bold text-slate-200">{data.name}</p>
        <p className="font-black text-white text-sm">{formatIDR(data.value)}</p>
        <p className="text-slate-400 font-medium">Kontribusi: {data.percentage}%</p>
      </div>
    );
  }
  return null;
};

// Custom Legend biar layout list kategori di sebelah chart-nya rapi & scannable
const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-2">
      {payload.map((entry: any, index: number) => (
        <li key={`item-${index}`} className="flex items-center gap-2 truncate">
          <span 
            className="w-2.5 h-2.5 rounded-md flex-shrink-0" 
            style={{ backgroundColor: entry.color }} 
          />
          <span className="truncate flex-1 font-medium">{entry.value}</span>
          <span className="text-slate-400 dark:text-slate-500 font-black">
            {entry.payload.percentage}%
          </span>
        </li>
      ))}
    </ul>
  );
};

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[320px] text-slate-400">
        <p className="text-sm font-medium">Belum ada data pengeluaran bulan ini, Cuy.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800/60 flex flex-col justify-between h-full">
      <div>
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Proporsi Pengeluaran Kategori
        </h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Breakdown distribusi jatah keluar dompet bulan ini.
        </p>
      </div>

      <div className="w-full h-[220px] my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]} 
                  className="focus:outline-none"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} layout="horizontal" verticalAlign="bottom" align="center" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};