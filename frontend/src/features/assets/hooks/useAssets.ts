import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

export interface Asset {
  id: string;
  name: string;
  category: string;
  balance: number;
  gold_weight_gram: number;
  ownership: 'bersama' | 'suami' | 'istri'; // SUNTIKAN ENTERPRISE KEPEMILIKAN!
  created_at?: string;
}

export const useAssets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [goldPrice, setGoldPrice] = useState<number>(1450000); // Harga buyback default per gram (Rp)

  // 1. AMBIL DATA ASET (SELECT + OWNERSHIP)
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const mappedAssets = (data || []).map((row: any) => ({
        id: String(row.id),
        name: row.name,
        category: row.category,
        balance: Number(row.balance || 0),
        gold_weight_gram: Number(row.gold_weight_gram || 0),
        ownership: row.ownership || 'bersama', // Fallback aman ke bersama
        created_at: row.created_at
      }));

      setAssets(mappedAssets);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. TAMBAH ASET BARU (INSERT)
  const addAsset = async (name: string, category: string, balance: number, goldWeight: number, ownership: string) => {
    try {
      const { error } = await supabase
        .from('assets')
        .insert([{ 
          name, 
          category, 
          balance, 
          gold_weight_gram: goldWeight,
          ownership // Masuk database murni, Cuy!
        }]);

      if (error) throw error;
      await fetchAssets();
      return { success: true };
    } catch (err) {
      console.error('Error adding asset:', err);
      return { success: false, error: err };
    }
  };

  // 3. EDIT ASET (UPDATE)
  const updateAsset = async (id: string, name: string, category: string, balance: number, goldWeight: number, ownership: string) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ 
          name, 
          category, 
          balance, 
          gold_weight_gram: goldWeight,
          ownership // Perubahan kepemilikan diakomodasi
        })
        .eq('id', id);

      if (error) throw error;
      await fetchAssets();
      return { success: true };
    } catch (err) {
      console.error('Error updating asset:', err);
      return { success: false, error: err };
    }
  };

  // 4. HAPUS ASET (DELETE)
  const deleteAsset = async (id: string) => {
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
      setAssets((prev) => prev.filter(a => a.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Error deleting asset:', err);
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  return { assets, loading, goldPrice, addAsset, updateAsset, deleteAsset, refreshAssets: fetchAssets };
};