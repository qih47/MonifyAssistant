import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

export interface Transaction {
  id: number;              // Sesuai int8
  pocket_id: number | null;// Sesuai int8
  pocket_name?: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  created_at: string;      // Sesuai nama kolom di DB lu
}

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. AMBIL DATA MUTASI (SELECT)
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          pocket_id,
          type,
          amount,
          description,
          created_at,
          pockets ( display_name )
        `)
        .order('created_at', { ascending: false }); // Urutkan dari yang paling baru

      if (error) throw error;

      const mappedTransactions = (data || []).map((row: any) => ({
        id: Number(row.id),
        pocket_id: row.pocket_id ? Number(row.pocket_id) : null,
        pocket_name: row.pockets?.display_name || 'Tanpa Kantong',
        type: row.type,
        amount: Number(row.amount || 0),
        description: row.description || '',
        created_at: row.created_at
      }));

      setTransactions(mappedTransactions);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. TAMBAH MUTASI MANUAL (INSERT + AUTO UPDATE SALDO KANTONG)
  const addTransaction = async (pocketId: number, type: 'income' | 'expense', amount: number, description: string) => {
    try {
      // a. Insert mutasi baru (kolom created_at otomatis terisi oleh default value now() di Supabase)
      const { error: txError } = await supabase
        .from('transactions')
        .insert([{ 
          pocket_id: pocketId, 
          type, 
          amount, 
          description 
        }]);

      if (txError) throw txError;

      // b. Ambil current_balance berjalan di kantong terkait
      const { data: pocketData, error: pocketFetchError } = await supabase
        .from('pockets')
        .select('current_balance')
        .eq('id', pocketId)
        .single();

      if (pocketFetchError) throw pocketFetchError;

      // c. Kalkulasi saldo baru
      const currentBalance = Number(pocketData.current_balance || 0);
      const newBalance = type === 'expense' 
        ? currentBalance - amount 
        : currentBalance + amount;

      // d. Update saldo berjalan ke tabel pockets
      const { error: updateError } = await supabase
        .from('pockets')
        .update({ current_balance: newBalance })
        .eq('id', pocketId);

      if (updateError) throw updateError;

      await fetchTransactions();
      return { success: true };
    } catch (err) {
      console.error('Error adding transaction:', err);
      return { success: false, error: err };
    }
  };

  // 3. HAPUS MUTASI (DELETE + ROLLBACK SALDO KANTONG)
  const deleteTransaction = async (id: number, pocketId: number | null, type: 'income' | 'expense', amount: number) => {
    try {
      if (pocketId) {
        // a. Ambil saldo kantong saat ini
        const { data: pocketData } = await supabase
          .from('pockets')
          .select('current_balance')
          .eq('id', pocketId)
          .single();

        if (pocketData) {
          // b. Kembalikan saldo sebelum mutasi ini dihapus
          const currentBalance = Number(pocketData.current_balance || 0);
          const rolledBackBalance = type === 'expense'
            ? currentBalance + amount
            : currentBalance - amount;

          await supabase
            .from('pockets')
            .update({ current_balance: rolledBackBalance })
            .eq('id', pocketId);
        }
      }

      // c. Hapus record transaksi
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTransactions((prev) => prev.filter(t => t.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Error deleting transaction:', err);
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return { transactions, loading, addTransaction, deleteTransaction, refreshTransactions: fetchTransactions };
};