import { supabase } from '../config/supabaseClient.js';

export async function createTransaction(entry: any) {
    const { error, data } = await supabase.from('transactions').insert([entry]).select();
    if (error) throw error;
    return data;
}

export async function insertTransactionNoSelect(entry: any) {
    const { error } = await supabase.from('transactions').insert([entry]);
    if (error) throw error;
}

export async function updatePocketBalance(pocketId: number, newBalance: number) {
    const { error, data } = await supabase.from('pockets').update({ current_balance: newBalance }).eq('id', pocketId).select();
    if (error) throw error;
    return data;
}

export async function updateAssetBalance(assetId: number, newBalance: number) {
    const { error, data } = await supabase.from('assets').update({ balance: newBalance }).eq('id', assetId).select();
    if (error) throw error;
    return data;
}
