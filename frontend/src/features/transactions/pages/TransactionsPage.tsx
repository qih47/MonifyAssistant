import React, { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { usePockets } from '../../pockets/hooks/usePockets';
import { formatIDR } from '../../../lib/formatter';
import { formatDateIndo } from '../../../lib/dateFormatter';
import { Plus, Loader2, X, Trash2, ArrowUpRight, ArrowDownLeft, FileSpreadsheet } from 'lucide-react';

export const TransactionsPage = () => {
  const { transactions, loading, addTransaction, deleteTransaction } = useTransactions();
  const { pockets } = usePockets(); // Tarik data kantong untuk opsi pilihan dropdown

  // State Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pocketId, setPocketId] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pocketId || !amount || !description) return;

    setIsSubmitting(true);
    const result = await addTransaction(parseInt(pocketId), type, parseFloat(amount), description);
    setIsSubmitting(false);

    if (result.success) {
      setIsModalOpen(false);
      setPocketId('');
      setAmount('');
      setDescription('');
    } else {
      alert('Gagal mencatat transaksi baru!');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER MUTASI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Riwayat Mutasi Transaksi</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Seluruh arus keuangan masuk dan keluar terpantau transparan di sini.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition-all shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus size={16} className="stroke-[3]" />
          <span>Catat Mutasi Manual</span>
        </button>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-3" size={32} />
          <p className="text-sm font-medium">Menarik data jurnal mutasi...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-900/20 dark:border-slate-800">
          <FileSpreadsheet size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h4 className="font-semibold text-slate-700 dark:text-slate-300">Belum Ada Transaksi</h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Belum ada laporan pengeluaran atau pemasukan yang tercatat di dalam jurnal keuangan.</p>
        </div>
      ) : (
        /* JURNAL TABEL MUTASI */
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 dark:bg-slate-800/40 dark:border-slate-800/60 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">Tanggal & Waktu</th>
                <th className="py-4 px-6">Deskripsi Laporan</th>
                <th className="py-4 px-6">Alokasi Pos Kantong</th>
                <th className="py-4 px-6 text-right">Nominal</th>
                <th className="py-4 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-sm">
              {transactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6 text-xs font-medium text-slate-400 dark:text-slate-500 font-mono">
                      {formatDateIndo(tx.created_at)}
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200">
                      {tx.description}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 border border-slate-200/40 text-slate-600 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                        {tx.pocket_name}
                      </span>
                    </td>
                    <td className={`py-4 px-6 text-right font-bold font-mono ${isExpense ? 'text-rose-500' : 'text-emerald-500'}`}>
                      <span className="inline-flex items-center gap-1">
                        {isExpense ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        {isExpense ? '-' : '+'}{formatIDR(tx.amount)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => deleteTransaction(tx.id, tx.pocket_id, tx.type, tx.amount)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Hapus Jurnal & Balikkan Saldo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL INPUT MUTASI MANUAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <X size={18} />
            </button>

            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Catat Jurnal Keuangan</h4>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Jenis Transaksi</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${type === 'expense' ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-800' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-950 dark:border-slate-800'}`}
                  >
                    Uang Keluar (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${type === 'income' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-950 dark:border-slate-800'}`}
                  >
                    Uang Masuk (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Pilih Kantong Sumber/Tujuan</label>
                <select
                  required
                  value={pocketId}
                  onChange={(e) => setPocketId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">-- Pilih Kantong Dana --</option>
                  {pockets.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name} (Sisa: {formatIDR(p.current_balance)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nominal Transaksi (Rp)</label>
                <input type="number" required placeholder="Contoh: 50000" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Deskripsi / Keperluan</label>
                <input type="text" required placeholder="Contoh: Beli nasi goreng malam & martabak" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition-all">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-50">
                  {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                  <span>Simpan Transaksi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};