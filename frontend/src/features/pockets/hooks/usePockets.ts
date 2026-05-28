import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

export interface Pocket {
  id: string;
  name: string;
  display_name: string;
  allocated_budget: number;
  current_balance: number;
  ownership: 'bersama' | 'suami' | 'istri'; // SUNTIKAN KEPEMILIKAN PREMIUM!
  created_at?: string;
}

export const usePockets = () => {
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Ambil Data (SELECT + OWNERSHIP)
  const fetchPockets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pockets')
        .select('*')
        .order('display_name', { ascending: true });

      if (error) throw error;

      const mappedPockets = (data || []).map((row: any) => ({
        id: String(row.id),
        name: row.name,
        display_name: row.display_name || row.name,
        allocated_budget: Number(row.target_budget || 0),
        current_balance: Number(row.current_balance || 0),
        ownership: row.ownership || 'bersama', // Fallback aman
        created_at: row.created_at
      }));

      setPockets(mappedPockets);
    } catch (err) {
      console.error('Error fetching pockets:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Tambah Data (INSERT)
  const addPocket = async (displayName: string, allocatedBudget: number, ownership: string) => {
    try {
      const snakeName = displayName.trim().toLowerCase().replace(/\s+/g, '_');

      const { error } = await supabase
        .from('pockets')
        .insert([{
          name: snakeName,
          display_name: displayName,
          target_budget: allocatedBudget,
          current_balance: allocatedBudget,
          ownership // Masuk DB murni, Cuy!
        }]);

      if (error) throw error;
      await fetchPockets();
      return { success: true };
    } catch (err) {
      console.error('Error adding pocket:', err);
      return { success: false, error: err };
    }
  };

  // 3. Update Data (UPDATE)
  const updatePocket = async (id: string, displayName: string, allocatedBudget: number, currentBalance: number, ownership: string) => {
    try {
      const snakeName = displayName.trim().toLowerCase().replace(/\s+/g, '_');
      const { error } = await supabase
        .from('pockets')
        .update({
          name: snakeName,
          display_name: displayName,
          target_budget: allocatedBudget,
          current_balance: currentBalance,
          ownership // Sinkron terupdate
        })
        .eq('id', id);

      if (error) throw error;
      await fetchPockets();
      return { success: true };
    } catch (err) {
      console.error('Error updating pocket:', err);
      return { success: false, error: err };
    }
  };

  // 4. Hapus Data (DELETE)
  const deletePocket = async (id: string) => {
    try {
      const { error } = await supabase.from('pockets').delete().eq('id', id);
      if (error) throw error;
      setPockets((prev) => prev.filter(p => p.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Error deleting pocket:', err);
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchPockets();
  }, []);

  return { pockets, loading, addPocket, updatePocket, deletePocket, refreshPockets: fetchPockets };
};