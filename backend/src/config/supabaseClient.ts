import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Ambil variabel env khusus server side
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Ganti ke Service Role Key!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ ERROR: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset di .env backend!");
  process.exit(1);
}

// Inisialisasi client Supabase dengan opsi Service Role Key
// Ini penting agar Bot Telegram (CAKRA AI) bisa bypass RLS untuk manipulasi transaksi, kantong, & aset
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Matikan local storage session karena ini berjalan di lingkungan server Node.js
    autoRefreshToken: false
  }
});

console.log('⚡ Koneksi Supabase Server (Service Role Mode) berhasil diinisialisasi!');