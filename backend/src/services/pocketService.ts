import { supabase } from '../config/supabaseClient.js';

export async function getPocketByName(name: string) {
    const { data, error } = await supabase.from('pockets').select('*').eq('name', name).maybeSingle();
    if (error) throw error;
    return data;
}

export async function getPocketById(id: number) {
    const { data, error } = await supabase.from('pockets').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

export async function updatePocketCurrentBalance(id: number, newBalance: number) {
    const { data, error } = await supabase.from('pockets').update({ current_balance: newBalance }).eq('id', id).select();
    if (error) throw error;
    return data;
}
