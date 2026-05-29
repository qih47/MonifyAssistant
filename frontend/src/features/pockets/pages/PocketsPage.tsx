import React, { useState } from 'react';
import { usePockets, type Pocket } from '../hooks/usePockets';
import { formatIDR } from '../../../lib/formatter';
import { Plus, FolderPlus, Loader2, X, Pencil, Trash2, Wallet } from 'lucide-react';

const formatPocketName = (name: string): string => {
  if (!name) return '';
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const PocketsPage = () => {
  const { pockets, assets, loading, addPocket, updatePocket, deletePocket } = usePockets();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState<Pocket | null>(null);

  const [pocketName, setPocketName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [ownership, setOwnership] = useState('bersama');
  const [selectedAssetId, setSelectedAssetId] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenCreate = () => {
    setEditingPocket(null);
    setPocketName('');
    setBudgetAmount('');
    setCurrentBalance('');
    setOwnership('bersama');
    setSelectedAssetId(assets[0]?.id || 0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pocket: Pocket) => {
    setEditingPocket(pocket);
    setPocketName(pocket.display_name);
    setBudgetAmount(pocket.allocated_budget.toString());
    setCurrentBalance(pocket.current_balance.toString());
    setOwnership(pocket.ownership || 'bersama');
    setSelectedAssetId(pocket.asset_id || assets[0]?.id || 0);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string, pocket: Pocket) => {
    const cleanName = formatPocketName(name);
    const confirmMsg = pocket.current_balance > 0
      ? `Hapus kantong "${cleanName}"?\n\nSaldo ${formatIDR(pocket.current_balance)} akan dikembalikan ke ${pocket.asset_name || 'asset'}.`
      : `Hapus kantong "${cleanName}"?`;
      
    if (window.confirm(confirmMsg)) {
      const result = await deletePocket(id);
      if (!result.success) alert('Gagal menghapus kantong dana!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pocketName || !budgetAmount || !selectedAssetId) {
      alert('Lengkapi semua field!');
      return;
    }

    setIsSubmitting(true);
    let result;

    if (editingPocket) {
      const finalBalance = currentBalance ? parseFloat(currentBalance) : parseFloat(budgetAmount);
      result = await updatePocket(
        editingPocket.id, pocketName, parseFloat(budgetAmount), finalBalance, ownership, selectedAssetId
      );
    } else {
      result = await addPocket(pocketName, parseFloat(budgetAmount), ownership, selectedAssetId);
    }

    setIsSubmitting(false);

    if (result.success) {
      setIsModalOpen(false);
      setPocketName('');
      setBudgetAmount('');
      setCurrentBalance('');
    } else {
      const errorMsg = typeof result.error === 'string' ? result.error : 'Terjadi kesalahan!';
      alert(errorMsg);
    }
  };

  const getOwnershipBadge = (owner: string) => {
    switch (owner) {
      case 'suami':
        return <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400">Kantong Qisthi</span>;
      case 'istri':
        return <span className="text-[10px] font-black px-2 py-0.5 bg-pink-50 border border-pink-100 text-pink-600 rounded-md dark:bg-pink-950/40 dark:border-pink-900 dark:text-pink-400">Kantong Gita</span>;
      default:
        return <span className="text-[10px] font-black px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">Pos Bersama</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Kantong Alokasi Dana</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Kelola pembagian dana dari rekening ke pos-pos anggaran.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          disabled={assets.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition-all shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title={assets.length === 0 ? 'Tambahkan asset/rekening dulu' : 'Buat kantong baru'}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>Buat Kantong Baru</span>
        </button>
      </div>

      {/* INFO ASSET */}
      {assets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assets.map(asset => (
            <div key={asset.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <Wallet size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{asset.name}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{formatIDR(asset.balance)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-3" size={32} />
          <p className="text-sm font-medium">Menghubungkan ke Supabase...</p>
        </div>
      ) : pockets.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-900/20 dark:border-slate-800">
          <FolderPlus size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h4 className="font-semibold text-slate-700 dark:text-slate-300">Belum Ada Kantong Dana</h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
            {assets.length === 0 ? 'Tambahkan asset/rekening dulu di menu Harta & Aset.' : 'Klik tombol di atas untuk membuat pos alokasi dana.'}
          </p>
        </div>
      ) : (
        /* POCKETS GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pockets.map((pocket) => {
            const percent = pocket.allocated_budget > 0
              ? Math.min(Math.max((pocket.current_balance / pocket.allocated_budget) * 100, 0), 100)
              : 0;

            let barColor = 'bg-emerald-500';
            if (percent < 20) barColor = 'bg-rose-500';
            else if (percent < 50) barColor = 'bg-amber-500';

            return (
              <div key={pocket.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm dark:bg-slate-900 dark:border-slate-800/60 flex flex-col justify-between hover:shadow-md transition-all duration-200 group">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-col gap-1 truncate flex-1">
                      <span className="font-bold text-base text-slate-800 dark:text-slate-100 truncate">{pocket.display_name}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getOwnershipBadge(pocket.ownership)}
                      </div>
                      {pocket.asset_name && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Wallet size={12} className="text-slate-400" />
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{pocket.asset_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => handleOpenEdit(pocket)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(pocket.id, pocket.name, pocket)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Hapus"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 font-medium">Sisa Saldo Kantong</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{formatIDR(pocket.current_balance)}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${percent}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>Target: {formatIDR(pocket.allocated_budget)}</span>
                    <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-100/80 rounded dark:bg-slate-800 dark:border-slate-700">{Math.round(percent)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><X size={18} /></button>

            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{editingPocket ? 'Edit Kantong Dana' : 'Buat Kantong Dinamis'}</h4>
            <p className="text-xs text-slate-400 mb-5">{editingPocket ? 'Perbarui alokasi pos keuangan ini.' : 'Tambahkan pos pengeluaran dari rekening yang dipilih.'}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nama Kantong</label>
                <input type="text" required placeholder="Contoh: Jajan Qisthi" value={pocketName} onChange={(e) => setPocketName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Kepemilikan Kantong</label>
                <select value={ownership} onChange={(e) => setOwnership(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                  <option value="bersama">👪 Pos Bersama Rumah Tangga</option>
                  <option value="suami">🧑 Jatah Pribadi Qisthi</option>
                  <option value="istri">👩 Jatah Pribadi Gita</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Sumber Dana (Rekening)</label>
                {assets.length === 0 ? (
                  <div className="px-3.5 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                    ⚠️ Belum ada asset. Tambahkan di menu Harta & Aset.
                  </div>
                ) : (
                  <>
                    <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                      {assets.map(asset => (
                        <option key={asset.id} value={asset.id}>{asset.name} — Saldo: {formatIDR(asset.balance)}</option>
                      ))}
                    </select>
                    {selectedAssetId > 0 && (
                      <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                        <Wallet size={12} className="text-slate-400" />
                        <span className="text-slate-400">
                          Saldo tersedia: <span className="font-bold text-slate-600 dark:text-slate-300">{formatIDR(assets.find(a => a.id === selectedAssetId)?.balance || 0)}</span>
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">Saldo asset akan dipotong sebesar budget.</p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Target Budget (Rp)</label>
                <input type="number" required placeholder="Contoh: 1000000" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-800 dark:bg-slate-950" />
              </div>

              {editingPocket && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Sisa Saldo Berjalan (Rp)</label>
                  <input type="number" required placeholder="Saldo saat ini" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-800 dark:bg-slate-950" />
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-400">Batal</button>
                <button type="submit" disabled={isSubmitting || assets.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50">
                  {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                  <span>{editingPocket ? 'Simpan' : 'Simpan Alokasi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};