import React, { useState } from 'react';
import { useSavingGoals } from '../hooks/useSavingGoals';
import { GoalCard } from '../components/GoalCard';
import { CreateGoalModal } from '../components/CreateGoalModal';
import { supabase } from '../../../config/supabase';
import { Target, Plus, Loader2, PiggyBank } from 'lucide-react';

export const SavingGoalsPage: React.FC = () => {
  // 1. Ekstraksi updateGoal dan deleteGoal dari hook baru kita, Cuy! ✅
  const { goals, loading, createGoal, updateGoal, deleteGoal, addSavingLog } = useSavingGoals();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pockets, setPockets] = useState<any[]>([]);
  const [loadingPockets, setLoadingPockets] = useState(false);

  // Tarik data kantong internal secara real-time pas user mau interaksi belanja/setor
  const fetchPocketsData = React.useCallback(async () => {
    try {
      setLoadingPockets(true);
      const { data, error } = await supabase
        .from('pockets')
        .select('id, display_name, current_balance');
      if (error) throw error;
      setPockets(data || []);
    } catch (err) {
      console.error('Error fetching pockets for allocation:', err);
    } finally {
      setLoadingPockets(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPocketsData();
  }, [fetchPocketsData]);

  // Handler jembatan untuk fungsi setoran celengan
  const handleDepositSaving = async (goalId: number, amount: number, pocketId: number) => {
    const result = await addSavingLog(goalId, amount, pocketId);
    if (result.success) {
      // Refresh balance kantong lokal setelah dipotong
      await fetchPocketsData();
    }
    return result;
  };

  if (loading || loadingPockets) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Memuat Target Impian...</p>
      </div>
    );
  }

  const activeGoals = goals.filter(g => g.status === 'active');
  const achievedGoals = goals.filter(g => g.status === 'achieved');

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <PiggyBank size={20} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Target Tabungan Celengan
            </h1>
          </div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            Kelola alokasi dana impian masa depan dan barang elektronik keluarga secara disiplin.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all shadow-sm"
        >
          <Plus size={14} className="stroke-[3]" />
          <span>Tambah Impian</span>
        </button>
      </div>

      {/* EMPTY STATE */}
      {goals.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
          <Target size={40} className="text-slate-300 dark:text-slate-700 mb-3 stroke-[1.5]" />
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase">Belum Ada Target Impian</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mt-1">
            Yuk bikin list target baru, mulai dari ganti AC kamar, kulkas dua pintu, atau tabungan liburan bareng istri!
          </p>
        </div>
      )}

      {/* GRID TARGET AKTIF */}
      {activeGoals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
            🎯 Target Berjalan ({activeGoals.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeGoals.map((goal) => (
              <GoalCard 
                key={goal.id} 
                goal={goal} 
                pockets={pockets} 
                onDeposit={handleDepositSaving} 
                onUpdate={updateGoal} // 2. Link properti updateGoal murni di sini ✅
                onDelete={deleteGoal} // 3. Link properti deleteGoal murni di sini ✅
              />
            ))}
          </div>
        </div>
      )}

      {/* GRID TARGET LUNAS */}
      {achievedGoals.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
            🎉 Sudah Tercapai ({achievedGoals.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 opacity-75">
            {achievedGoals.map((goal) => (
              <GoalCard 
                key={goal.id} 
                goal={goal} 
                pockets={pockets} 
                onDeposit={handleDepositSaving} 
                onUpdate={updateGoal} // 4. Jalur aman update untuk card lunas ✅
                onDelete={deleteGoal} // 5. Jalur aman hapus untuk card lunas ✅
              />
            ))}
          </div>
        </div>
      )}

      {/* POP-UP CREATE MODAL */}
      <CreateGoalModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCreate={createGoal} 
      />

    </div>
  );
};