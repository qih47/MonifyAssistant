import { supabase } from '../config/supabaseClient.js';

export async function getAssetById(id: number) {
    const { data, error } = await supabase.from('assets').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

export async function getAssetByName(name: string) {
    const { data, error } = await supabase.from('assets').select('*').ilike('name', `%${name}%`).maybeSingle();
    if (error) throw error;
    return data;
}

export async function getAssetByOwner(owner: string) {
    const { data, error } = await supabase.from('assets').select('*').eq('ownership', owner).maybeSingle();
    if (error) throw error;
    return data;
}

export async function updateAssetBalance(id: number, newBalance: number) {
    const { data, error } = await supabase.from('assets').update({ balance: newBalance }).eq('id', id).select();
    if (error) throw error;
    return data;
}

export async function transferAssetBalance(sourceId: number, targetId: number, amount: number) {
    const source = await getAssetById(sourceId);
    const target = await getAssetById(targetId);
    if (!source || !target) throw new Error('Asset tidak ditemukan');

    await updateAssetBalance(sourceId, Number(source.balance) - amount);
    await updateAssetBalance(targetId, Number(target.balance) + amount);

    return { source, target };
}
