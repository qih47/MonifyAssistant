import React, { useState } from 'react';
import { formatIDR } from '../../../lib/formatter';
import type { SavingGoal } from '../hooks/useSavingGoals';
import { Calendar, ArrowUpRight, CheckCircle2, Loader2, Edit3, Trash2, X, Check } from 'lucide-react';

interface GoalCardProps {
    goal: SavingGoal;
    pockets: { id: number; display_name: string; current_balance: number }[];
    onDeposit: (goalId: number, amount: number, pocketId: number) => Promise<{ success: boolean; error?: string }>;
    onUpdate: (id: number, name: string, targetAmount: number, targetDate: string | null) => Promise<{ success: boolean; error?: any }>;
    onDelete: (id: number) => Promise<{ success: boolean; error?: any }>;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, pockets, onDeposit, onUpdate, onDelete }) => {
    // Mode Interaksi States
    const [isDepositing, setIsDepositing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);

    // Form States
    const [amount, setAmount] = useState('');
    const [selectedPocket, setSelectedPocket] = useState('');
    const [editName, setEditName] = useState(goal.name);
    const [editTarget, setEditTarget] = useState(goal.target_amount.toString());
    const [editDate, setEditDate] = useState(
        goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : ''
    );
    const [errorMsg, setErrorMsg] = useState('');

    const targetAmount = Number(goal.target_amount || 0);
    const currentAmount = Number(goal.current_amount || 0);
    const remaining = targetAmount - currentAmount;

    const percentage = targetAmount > 0 ? Math.min(Math.round((currentAmount / targetAmount) * 100), 100) : 0;
    const isAchieved = goal.status === 'achieved' || percentage >= 100;

    // Parser tanggal Unix timestamp milidetik murni (int8)
    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return 'Tanpa Tenggat';
        return new Date(timestamp).toLocaleDateString('id-ID', {
            month: 'short',
            year: 'numeric'
        });
    };

    const handleSaveUpdate = async () => {
        setErrorMsg('');
        if (!editName.trim()) return setErrorMsg('Nama gak boleh kosong, Cuy!');
        if (Number(editTarget) <= 0) return setErrorMsg('Target kudu di atas Rp 0!');

        try {
            setLoadingAction(true);
            const res = await onUpdate(goal.id, editName, Number(editTarget), editDate || null);
            if (res.success) setIsEditing(false);
            else setErrorMsg('Gagal edit target.');
        } catch {
            setErrorMsg('Masalah jaringan sistem.');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDeleteClick = async () => {
        if (window.confirm(`Serius mau hapus tabungan "${goal.name}" ini, Cuy? Sisa saldo terkumpul gak otomatis pindah loh.`)) {
            try {
                setLoadingAction(true);
                await onDelete(goal.id);
            } catch {
                alert('Gagal menghapus celengan.');
            } finally {
                setLoadingAction(false);
            }
        }
    };

    const handleSubmitedDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        const inputAmount = Number(amount);
        if (!inputAmount || inputAmount <= 0) return setErrorMsg('Nominal harus lebih dari Rp 0, Cuy!');
        if (!selectedPocket) return setErrorMsg('Pilih kantong sumber dananya dulu.');

        try {
            setLoadingAction(true);
            const res = await onDeposit(goal.id, inputAmount, Number(selectedPocket));
            if (res.success) {
                setAmount('');
                setIsDepositing(false);
            } else {
                setErrorMsg(res.error || 'Gagal menyimpan setoran.');
            }
        } catch {
            setErrorMsg('Terjadi kesalahan koneksi.');
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800/60 flex flex-col justify-between transition-all duration-300 hover:shadow-md relative group/card">
            
            {/* ACTION TOP BUTTONS (EDIT & DELETE TRIGGER) */}
            {!isEditing && (
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 z-10">
                    <button 
                        onClick={() => setIsEditing(true)} 
                        className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-700/60 dark:hover:text-white"
                        title="Edit Celengan"
                    >
                        <Edit3 size={12} />
                    </button>
                    <button 
                        onClick={handleDeleteClick} 
                        className="p-1.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-400 hover:text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/40"
                        title="Hapus Celengan"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            )}

            {isEditing ? (
                /* ─── INLINE EDIT MODE FORM ─── */
                <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
                        <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Mode Edit Celengan</span>
                        <div className="flex gap-1">
                            <button onClick={handleSaveUpdate} disabled={loadingAction} className="p-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600">
                                {loadingAction ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            </button>
                            <button onClick={() => setIsEditing(false)} className="p-1 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400">
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg dark:bg-slate-800/60 dark:border-slate-700 dark:text-white" placeholder="Nama Barang" />
                        <input type="number" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className="w-full px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg dark:bg-slate-800/60 dark:border-slate-700 dark:text-white" placeholder="Target Dana (Rp)" />
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg dark:bg-slate-800/60 dark:border-slate-700 dark:text-white font-mono" />
                    </div>
                    {errorMsg && <p className="text-[9px] font-bold text-rose-500">⚠️ {errorMsg}</p>}
                </div>
            ) : (
                /* ─── NORMAL DISPLAY MODE ─── */
                <div>
                    {/* HEADER CARD */}
                    <div className="flex items-start justify-between gap-2 mb-3 pr-12">
                        <div className="space-y-1">
                            <h4 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                {goal.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                <span className="flex items-center gap-0.5">
                                    <Calendar size={11} />
                                    Target: {formatDate(goal.deadline)}
                                </span>
                            </div>
                        </div>

                        {isAchieved ? (
                            <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 uppercase tracking-wider font-mono">
                                <CheckCircle2 size={10} className="stroke-[3]" /> Lunas
                            </span>
                        ) : (
                            <span className="text-[11px] font-mono font-black text-slate-500 dark:text-slate-400">
                                {percentage}%
                            </span>
                        )}
                    </div>

                    {/* NOMINAL FINANSIAL */}
                    <div className="space-y-0.5 my-3">
                        <p className="text-xs text-slate-400 font-medium">Dana Terkumpul</p>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-lg font-black text-slate-950 dark:text-white tracking-tight">
                                {formatIDR(currentAmount)}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
                                / {formatIDR(targetAmount)}
                            </span>
                        </div>
                    </div>

                    {/* PROGRESS BAR */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-4">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${isAchieved ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>

                    {/* SISA DANA KURANG */}
                    {!isAchieved && (
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            Kurang <span className="text-rose-600 dark:text-rose-400 font-mono font-black">{formatIDR(remaining)}</span> lagi untuk mencapai target.
                        </p>
                    )}
                </div>
            )}

            {/* FOOTER FORM SETOR CELENGAN */}
            {!isEditing && (
                <div className="mt-5 border-t border-slate-50 dark:border-slate-800/40 pt-4">
                    {!isDepositing ? (
                        <button
                            disabled={isAchieved || loadingAction}
                            onClick={() => setIsDepositing(true)}
                            className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${isAchieved
                                    ? 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700/60'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                                }`}
                        >
                            <span>Setor Celengan</span>
                            <ArrowUpRight size={14} className="stroke-[2.5]" />
                        </button>
                    ) : (
                        <form onSubmit={handleSubmitedDeposit} className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-2">
                                <input
                                    type="number"
                                    placeholder="Nominal Setoran (Rp)"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dark:bg-slate-800/50 dark:border-slate-800 dark:text-white"
                                    disabled={loadingAction}
                                />
                                <select
                                    value={selectedPocket}
                                    onChange={(e) => setSelectedPocket(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 dark:bg-slate-800/50 dark:border-slate-800 dark:text-white"
                                    disabled={loadingAction}
                                >
                                    <option value="">-- Pilih Kantong Sumber --</option>
                                    {pockets.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.display_name} ({formatIDR(p.current_balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {errorMsg && <p className="text-[10px] font-black text-rose-600 bg-rose-50/50 p-2 rounded-lg border border-rose-100/50 dark:bg-rose-950/20 dark:text-rose-400">⚠️ {errorMsg}</p>}

                            <div className="flex gap-2 text-[11px] font-bold uppercase tracking-wider">
                                <button
                                    type="button"
                                    onClick={() => { setIsDepositing(false); setErrorMsg(''); setAmount(''); }}
                                    className="flex-1 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700/50 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                                    disabled={loadingAction}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-sm transition-colors flex items-center justify-center gap-1"
                                    disabled={loadingAction}
                                >
                                    {loadingAction ? <Loader2 size={12} className="animate-spin" /> : <span>Konfirmasi</span>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};