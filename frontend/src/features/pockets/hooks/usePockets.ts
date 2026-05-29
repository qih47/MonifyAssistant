import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

export interface Pocket {
  id: string;
  name: string;
  display_name: string;
  allocated_budget: number;
  current_balance: number;
  ownership: 'bersama' | 'suami' | 'istri';
  asset_id?: number;
  asset_name?: string;
  asset_balance?: number;
  created_at?: string;
}

export interface Asset {
  id: number;
  name: string;
  balance: number; // ✅ Ganti jadi balance
}

export const usePockets = () => {
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPockets = async () => {
    try {
      setLoading(true);
      
      // Query terpisah (hindari join error)
      const { data, error } = await supabase
        .from('pockets')
        .select('*')
        .order('display_name', { ascending: true });

      if (error) throw error;

      // Ambil asset_id dari pockets
      const assetIds = [...new Set((data || []).map((p: any) => p.asset_id).filter(Boolean))];
      let assetMap: Record<number, any> = {};
      
      if (assetIds.length > 0) {
        const { data: assetsData } = await supabase
          .from('assets')
          .select('id, name, balance') // ✅ Ganti jadi balance
          .in('id', assetIds);
        
        (assetsData || []).forEach(a => {
          assetMap[a.id] = a;
        });
      }

      const mappedPockets = (data || []).map((row: any) => ({
        id: String(row.id),
        name: row.name,
        display_name: row.display_name || row.name,
        allocated_budget: Number(row.target_budget || 0),
        current_balance: Number(row.current_balance || 0),
        ownership: row.ownership || 'bersama',
        asset_id: row.asset_id,
        asset_name: row.asset_id ? assetMap[row.asset_id]?.name : undefined,
        asset_balance: row.asset_id ? Number(assetMap[row.asset_id]?.balance || 0) : 0, // ✅ balance
        created_at: row.created_at
      }));

      setPockets(mappedPockets);
    } catch (err) {
      console.error('Error fetching pockets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('id, name, balance') // ✅ Ganti jadi balance
        .order('name', { ascending: true });

      if (error) throw error;
      
      const mapped = (data || []).map(a => ({
        id: a.id,
        name: a.name,
        balance: Number(a.balance || 0) // ✅ balance
      }));
      
      setAssets(mapped);
    } catch (err) {
      console.error('Error fetching assets:', err);
    }
  };

  const addPocket = async (displayName: string, allocatedBudget: number, ownership: string, assetId: number) => {
    try {
      const snakeName = displayName.trim().toLowerCase().replace(/\s+/g, '_');

      // Cek saldo asset
      const { data: asset } = await supabase
        .from('assets')
        .select('balance') // ✅ balance
        .eq('id', assetId)
        .single();

      const saldoAsset = Number(asset?.balance || 0); // ✅ balance

      if (saldoAsset < allocatedBudget) {
        return { 
          success: false, 
          error: `Saldo asset tidak mencukupi! Sisa saldo: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(saldoAsset)}` 
        };
      }

      // Potong saldo asset
      await supabase
        .from('assets')
        .update({ balance: saldoAsset - allocatedBudget }) // ✅ balance
        .eq('id', assetId);

      // Insert pocket
      const { error } = await supabase
        .from('pockets')
        .insert([{
          name: snakeName,
          display_name: displayName,
          target_budget: allocatedBudget,
          current_balance: allocatedBudget,
          ownership,
          asset_id: assetId
        }]);

      if (error) throw error;
      await fetchPockets();
      await fetchAssets();
      return { success: true };
    } catch (err) {
      console.error('Error adding pocket:', err);
      return { success: false, error: err };
    }
  };

  const updatePocket = async (id: string, displayName: string, allocatedBudget: number, currentBalance: number, ownership: string, assetId: number) => {
    try {
      const snakeName = displayName.trim().toLowerCase().replace(/\s+/g, '_');
      const { error } = await supabase
        .from('pockets')
        .update({
          name: snakeName,
          display_name: displayName,
          target_budget: allocatedBudget,
          current_balance: currentBalance,
          ownership,
          asset_id: assetId
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

  const deletePocket = async (id: string) => {
    try {
      // Kembalikan saldo ke asset
      const pocket = pockets.find(p => p.id === id);
      if (pocket && pocket.asset_id && pocket.current_balance > 0) {
        const { data: asset } = await supabase
          .from('assets')
          .select('balance') // ✅ balance
          .eq('id', pocket.asset_id)
          .single();

        if (asset) {
          await supabase
            .from('assets')
            .update({ balance: Number(asset.balance) + pocket.current_balance }) // ✅ balance
            .eq('id', pocket.asset_id);
        }
      }

      const { error } = await supabase.from('pockets').delete().eq('id', id);
      if (error) throw error;
      setPockets((prev) => prev.filter(p => p.id !== id));
      await fetchAssets();
      return { success: true };
    } catch (err) {
      console.error('Error deleting pocket:', err);
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchPockets();
    fetchAssets();
  }, []);

  return { pockets, assets, loading, addPocket, updatePocket, deletePocket, refreshPockets: fetchPockets };
};