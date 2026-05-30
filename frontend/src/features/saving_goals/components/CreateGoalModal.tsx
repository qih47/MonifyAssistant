import React, { useState } from 'react';
import { Target, Calendar, X, PlusCircle, Loader2 } from 'lucide-react';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, targetAmount: number, targetDate: string | null) => Promise<{ success: boolean; error?: any }>;
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Nama target impian tidak boleh kosong, Cuy!');
      return;
    }

    const amount = Number(targetAmount);
    if (!amount || amount <= 0) {
      setErrorMsg('Nominal target tabungan harus lebih dari Rp 0!');
      return;
    }

    try {
      setLoading(true);
      const isoDate = targetDate ? new Date(targetDate).toISOString() : null;
      
      const res = await onCreate(name, amount, isoDate);
      if (res.success) {
        // Reset Form State
        setName('');
        setTargetAmount('');
        setTargetDate('');
        onClose(); // Tutup Modal
      } else {
        setErrorMsg('Waduh, gagal bikin target tabungan baru. Coba cek koneksi.');
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan sistem internal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xl w-full max-w-md p-6 dark:bg-slate-900 dark:border-slate-800/80 animate-in zoom-in-95 duration-200 flex flex-col justify-between">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl dark:bg-blue-950/40 dark:text-blue-400">
              <Target size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Tambah Target Impian
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Set pos tabungan aset baru bersama istri.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* MODAL FORM BODY */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* INPUT NAMA IMPIAN */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Nama Impian / Barang
            </label>
            <input
              type="text"
              placeholder="Contoh: Kulkas Dua Pintu, AC Kamar, Sapi Qurban"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dark:bg-slate-800/50 dark:border-slate-800 dark:text-white"
              disabled={loading}
              maxLength={40}
            />
          </div>

          {/* INPUT NOMINAL TARGET */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Nominal Target Dana (Rp)
            </label>
            <input
              type="number"
              placeholder="Contoh: 4500000"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dark:bg-slate-800/50 dark:border-slate-800 dark:text-white"
              disabled={loading}
            />
          </div>

          {/* INPUT TENGGAT WAKTU (DATE PICKER) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={11} />
              Tenggat Waktu Target (Opsional)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dark:bg-slate-800/50 dark:border-slate-800 dark:text-white font-mono"
              disabled={loading}
            />
          </div>

          {/* WARNING ERROR CONTAINER */}
          {errorMsg && (
            <p className="text-[10px] font-black text-rose-600 bg-rose-50/50 dark:bg-rose-950/20 dark:text-rose-400 p-2.5 rounded-xl border border-rose-100/50 dark:border-rose-900/40 animate-pulse">
              ⚠️ {errorMsg}
            </p>
          )}

          {/* FOOTER BUTTONS ACTIONS */}
          <div className="flex gap-2 text-xs font-bold uppercase tracking-wider border-t border-slate-50 dark:border-slate-800/50 pt-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700/50 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 shadow-sm transition-colors flex items-center justify-center gap-1.5"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <span>Buat Target</span>
                  <PlusCircle size={14} className="stroke-[2.5]" />
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};