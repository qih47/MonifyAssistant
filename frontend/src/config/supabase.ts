import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ ERROR: URL atau Anon Key Supabase untuk Frontend belum diset di .env.local!");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');