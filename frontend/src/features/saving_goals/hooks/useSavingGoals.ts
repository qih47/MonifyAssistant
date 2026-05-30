import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

export interface SavingGoal {
    id: number;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline: number | null; // <--- Sesuai DB lu: int8 Unix timestamp milidetik
    status: 'active' | 'achieved';
    created_at: string;
}

export interface SavingLog {
    id: number;
    goal_id: number;
    amount: number;
    source_pocket_id: number;
    pocket_name?: string;
    created_at: string;
}

export const useSavingGoals = () => {
    const [goals, setGoals] = useState<SavingGoal[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGoals = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('saving_goals')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setGoals(data || []);
        } catch (err) {
            console.error('Error fetching saving goals:', err);
        } finally {
            setLoading(false);
        }
    };

    const createGoal = async (name: string, targetAmount: number, targetDate: string | null) => {
        try {
            const deadlineAsBigInt = targetDate ? new Date(targetDate).getTime() : null;
            const { data, error } = await supabase
                .from('saving_goals')
                .insert([{
                    name,
                    target_amount: targetAmount,
                    current_amount: 0,
                    deadline: deadlineAsBigInt,
                    status: 'active'
                }])
                .select();

            if (error) throw error;
            setGoals((prev) => [data[0], ...prev]);
            return { success: true };
        } catch (err) {
            console.error('Error creating saving goal:', err);
            return { success: false, error: err };
        }
    };

    // ─── 🛠️ FITUR BARU: UPDATE GOAL MURNI ───
    const updateGoal = async (id: number, name: string, targetAmount: number, targetDate: string | null) => {
        try {
            const deadlineAsBigInt = targetDate ? new Date(targetDate).getTime() : null;
            const { error } = await supabase
                .from('saving_goals')
                .update({
                    name,
                    target_amount: targetAmount,
                    deadline: deadlineAsBigInt
                })
                .eq('id', id);

            if (error) throw error;
            await fetchGoals();
            return { success: true };
        } catch (err) {
            console.error('Error updating saving goal:', err);
            return { success: false, error: err };
        }
    };

    // ─── 🛠️ FITUR BARU: DELETE GOAL MURNI ───
    const deleteGoal = async (id: number) => {
        try {
            const { error } = await supabase
                .from('saving_goals')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setGoals((prev) => prev.filter(g => g.id !== id));
            return { success: true };
        } catch (err) {
            console.error('Error deleting saving goal:', err);
            return { success: false, error: err };
        }
    };

    const addSavingLog = async (goalId: number, amount: number, sourcePocketId: number) => {
        try {
            const { data: goal } = await supabase.from('saving_goals').select('*').eq('id', goalId).single();
            const { data: pocket } = await supabase.from('pockets').select('*').eq('id', sourcePocketId).single();

            if (!goal || !pocket) throw new Error('Data target atau kantong tidak ditemukan.');
            if (Number(pocket.current_balance) < amount) throw new Error('Saldo kantong sumber tidak mencukupi, Cuy!');

            const { error: logError } = await supabase
                .from('saving_logs')
                .insert([{ goal_id: goalId, amount, source_pocket_id: sourcePocketId }]);

            if (logError) throw logError;

            const newCurrentAmount = Number(goal.current_amount) + amount;
            const isAchieved = newCurrentAmount >= Number(goal.target_amount);

            const { error: goalUpdateError } = await supabase
                .from('saving_goals')
                .update({
                    current_amount: newCurrentAmount,
                    status: isAchieved ? 'achieved' : 'active'
                })
                .eq('id', goalId);

            if (goalUpdateError) throw goalUpdateError;

            const { error: pocketUpdateError } = await supabase
                .from('pockets')
                .update({ current_balance: Number(pocket.current_balance) - amount })
                .eq('id', sourcePocketId);

            if (pocketUpdateError) throw pocketUpdateError;

            await fetchGoals();
            return { success: true };
        } catch (err: any) {
            console.error('Error adding saving log:', err);
            return { success: false, error: err.message || err };
        }
    };

    useEffect(() => {
        fetchGoals();
    }, []);

    return { goals, loading, refreshGoals: fetchGoals, createGoal, updateGoal, deleteGoal, addSavingLog };
};