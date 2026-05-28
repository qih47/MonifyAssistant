import React, { useState } from 'react';
import { useAssets, type Asset } from '../hooks/useAssets';
import { formatIDR } from '../../../lib/formatter';
import { Plus, Loader2, X, Pencil, Trash2, Wallet, Coins, Landmark, Trophy, User } from 'lucide-react';

export const AssetsPage = () => {
  const { assets, loading, goldPrice, addAsset, updateAsset, deleteAsset } = useAssets();

  // State Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tabungan');
  const [balance, setBalance] = useState('');
  const [goldWeight, setGoldWeight] = useState('');
  const [ownership, setOwnership] = useState('bersama'); // State baru untuk ownership
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hitung Total Kekayaan Bersama Dinamis
  const totalRupiahAset = assets.reduce((total, asset) => {
    const value = asset.category.toLowerCase() === 'emas'
      ? (asset.gold_weight_gram * goldPrice)
      : asset.balance;
    return total + value;
  }, 0);

  const handleOpenCreate = () => {
    setEditingAsset(null);
    setName('');
    setCategory('Tabungan');
    setBalance('');
    setGoldWeight('');
    setOwnership('bersama');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setName(asset.name);
    setCategory(asset.category);
    setBalance(asset.balance.toString());
    setGoldWeight(asset.gold_weight_gram.toString());
    setOwnership(asset.ownership);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, assetName: string) => {
    if (window.confirm(`Beneran mau hapus aset "${assetName}"?`)) {
      const result = await deleteAsset(id);
      if (!result.success) alert('Gagal menghapus aset!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSubmitting(true);
    const finalBalance = category.toLowerCase() === 'emas' ? 0 : parseFloat(balance || '0');
    const finalGoldWeight = category.toLowerCase() === 'emas' ? parseFloat(goldWeight || '0') : 0;

    let result;
    if (editingAsset) {
      result = await updateAsset(editingAsset.id, name, category, finalBalance, finalGoldWeight, ownership);
    } else {
      result = await addAsset(name, category, finalBalance, finalGoldWeight, ownership);
    }

    setIsSubmitting(false);
    if (result.success) {
      setIsModalOpen(false);
    } else {
      alert('Gagal menyimpan data aset!');
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'cash': return <Coins size={18} className="text-amber-500" />;
      case 'dompet digital': return <Wallet size={18} className="text-purple-500" />;
      case 'emas': return <Trophy size={18} className="text-yellow-500" />;
      case 'investasi': return <Wallet size={18} className="text-emerald-500" />;
      default: return <Landmark size={18} className="text-blue-500" />;
    }
  };

  // Helper untuk mewarnai label Kepemilikan Aset
  const getOwnershipBadge = (owner: string) => {
    switch (owner) {
      case 'suami':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400">Pegangan Qisthi</span>;
      case 'istri':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-pink-50 border border-pink-100 text-pink-600 rounded-md dark:bg-pink-950/40 dark:border-pink-900 dark:text-pink-400">Pegangan Gita</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">Dana Bersama</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* RINGKASAN KEKAYAAN BERSIH TOTAL */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Kekayaan Bersih Gabungan</p>
          <h2 className="text-3xl font-black tracking-tight text-white">{formatIDR(totalRupiahAset)}</h2>
          <p className="text-xs text-slate-400 mt-1">Akumulasi aset operasional, mandiri, & valuasi emas otomatis ({formatIDR(goldPrice)}/gr).</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all shadow-md self-start md:self-auto"
        >
          <Plus size={16} className="stroke-[3]" />
          <span>Tambah Aset Baru</span>
        </button>
      </div>

      {/* LOADING & TABLE STATE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-3" size={32} />
          <p className="text-sm font-medium">Menarik data aset dari Supabase...</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-900/20 dark:border-slate-800">
          <p className="text-sm text-slate-400">Belum ada catatan aset. Klik tombol di atas untuk mengisi!</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 dark:bg-slate-800/40 dark:border-slate-800/60 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">Nama Aset</th>
                <th className="py-4 px-6">Kategori</th>
                <th className="py-4 px-6">Kepemilikan Aset</th> {/* KOLOM INFO BARU! */}
                <th className="py-4 px-6">Kuantitas / Saldo</th>
                <th className="py-4 px-6 text-right">Nilai Rupiah</th>
                <th className="py-4 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-sm">
              {assets.map((asset) => {
                const isGold = asset.category.toLowerCase() === 'emas';
                const rupiahValue = isGold ? (asset.gold_weight_gram * goldPrice) : asset.balance;

                return (
                  <tr key={asset.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200">{asset.name}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-400">
                        {getCategoryIcon(asset.category)}
                        <span>{asset.category}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {getOwnershipBadge(asset.ownership)} {/* RENDER BADGE WARNA NYALA */}
                    </td>
                    <td className="py-4 px-6 font-mono font-medium text-slate-700 dark:text-slate-300">
                      {isGold ? `${asset.gold_weight_gram} gram` : formatIDR(asset.balance)}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-900 dark:text-white">
                      {formatIDR(rupiahValue)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenEdit(asset)} className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(asset.id, asset.name)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL INPUT MULTIFUNGSI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
              <X size={18} />
            </button>

            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-5">
              {editingAsset ? 'Edit Catatan Aset' : 'Tambah Aset Keluarga'}
            </h4>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nama Aset</label>
                <input type="text" required placeholder="Contoh: Mandiri Qisthi, LinkAja Corporate" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                  <option value="Tabungan">Tabungan Bank</option>
                  <option value="Dompet Digital">Dompet Digital</option>
                  <option value="Cash">Cash / Tunai</option>
                  <option value="Emas">Emas / Logam Mulia</option>
                  <option value="Investasi">Investasi / Reksadana</option>
                </select>
              </div>

              {/* ─── SUNTIKKAN DROPDOWN OWNERSHIP DI SINI, CUY! ─── */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Kepemilikan Saldo Harta</label>
                <select value={ownership} onChange={(e) => setOwnership(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                  <option value="bersama">👪 Dana Bersama Keuangan Utama</option>
                  <option value="suami">🧑 Pegangan Pribadi Qisthi (Suami)</option>
                  <option value="istri">👩 Pegangan Pribadi Gita (Istri)</option>
                </select>
              </div>
              {/* ────────────────────────────────────────────────── */}

              {category.toLowerCase() === 'emas' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Berat Emas (Gram)</label>
                  <input type="number" step="0.001" required placeholder="Contoh: 10.5" value={goldWeight} onChange={(e) => setGoldWeight(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Saldo Rupiah (Rp)</label>
                  <input type="number" required placeholder="Contoh: 1500000" value={balance} onChange={(e) => setBalance(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950" />
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-400">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-50">
                  {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                  <span>Simpan Aset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};