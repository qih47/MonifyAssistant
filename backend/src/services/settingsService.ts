import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabaseClient.js';

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  telegram_id?: string;
  telegram_chat_id?: string;
  color?: string;
}

export interface TelegramConfig {
  enabled: boolean;
  bot_token?: string;
  bot_username?: string;
}

export interface AppSettings {
  id?: string;
  household_name: string;
  currency: string;
  low_fund_threshold: number;
  partner_enabled: boolean; // Toggle untuk mengaktifkan / menonaktifkan akun pasangan
  member_1: FamilyMember;
  member_2: FamilyMember;
  telegram_config: TelegramConfig;
  updated_at?: string;
}

// Fallback local storage file jika tabel Supabase belum dibuat di Dashboard
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Inisialisasi default dari environment atau template awal
function getDefaultSettings(): AppSettings {
  let envUsers: Record<string, string> = {};
  try {
    if (process.env.ALLOWED_USERS) {
      envUsers = JSON.parse(process.env.ALLOWED_USERS);
    }
  } catch {}

  const userIds = Object.keys(envUsers);
  const member1Telegram = userIds[0] || process.env.TELEGRAM_CHAT_ID_SUAMI || '';
  const member2Telegram = userIds[1] || process.env.TELEGRAM_CHAT_ID_ISTRI || '';

  return {
    household_name: 'Keluarga Bahagia',
    currency: 'IDR',
    low_fund_threshold: 100000,
    partner_enabled: false, // Default 1 pengguna (laki-laki / single)
    member_1: {
      id: 'member_1',
      name: 'Qisthi',
      role: 'Suami',
      telegram_id: member1Telegram,
      telegram_chat_id: member1Telegram,
      color: 'emerald'
    },
    member_2: {
      id: 'member_2',
      name: 'Gita',
      role: 'Istri',
      telegram_id: member2Telegram,
      telegram_chat_id: member2Telegram,
      color: 'violet'
    },
    telegram_config: {
      enabled: !!process.env.TELEGRAM_BOT_TOKEN,
      bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
      bot_username: 'MoniBot'
    },
    updated_at: new Date().toISOString()
  };
}

// Helper untuk membaca file lokal
function readLocalSettings(): AppSettings {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.partner_enabled === undefined) {
        parsed.partner_enabled = false;
      }
      return parsed;
    }
  } catch (err) {
    console.warn('⚠️ Gagal membaca settings lokal:', err);
  }
  const defaults = getDefaultSettings();
  writeLocalSettings(defaults);
  return defaults;
}

// Helper untuk menulis file lokal
function writeLocalSettings(settings: AppSettings): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Gagal menulis settings lokal:', err);
  }
}

/**
 * Mengambil pengaturan aplikasi (Supabase jika ada, fallback ke file lokal)
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        household_name: data.household_name || 'Keluarga Bahagia',
        currency: data.currency || 'IDR',
        low_fund_threshold: Number(data.low_fund_threshold) || 100000,
        partner_enabled: data.partner_enabled !== undefined ? !!data.partner_enabled : false,
        member_1: data.member_1 || getDefaultSettings().member_1,
        member_2: data.member_2 || getDefaultSettings().member_2,
        telegram_config: data.telegram_config || getDefaultSettings().telegram_config,
        updated_at: data.updated_at
      };
    }
  } catch (err) {
    // Supabase table mungkin belum ada, fallback ke lokal
  }

  return readLocalSettings();
}

/**
 * Menyimpan / memperbarui pengaturan aplikasi
 */
export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();

  // Validasi ketat: Hanya mendukung maksimal 2 anggota
  const updatedMember1 = updates.member_1 ? { ...current.member_1, ...updates.member_1, id: 'member_1' } : current.member_1;
  const updatedMember2 = updates.member_2 ? { ...current.member_2, ...updates.member_2, id: 'member_2' } : current.member_2;

  const merged: AppSettings = {
    ...current,
    ...updates,
    household_name: updates.household_name?.trim() || current.household_name,
    currency: updates.currency || current.currency,
    low_fund_threshold: updates.low_fund_threshold !== undefined ? Number(updates.low_fund_threshold) : current.low_fund_threshold,
    partner_enabled: updates.partner_enabled !== undefined ? !!updates.partner_enabled : (current.partner_enabled ?? false),
    member_1: updatedMember1,
    member_2: updatedMember2,
    telegram_config: {
      ...current.telegram_config,
      ...(updates.telegram_config || {})
    },
    updated_at: new Date().toISOString()
  };

  // Simpan ke Supabase jika tabel ada
  try {
    const { data: existing } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
    if (existing?.id) {
      const { data, error } = await supabase
        .from('app_settings')
        .update({
          household_name: merged.household_name,
          currency: merged.currency,
          low_fund_threshold: merged.low_fund_threshold,
          partner_enabled: merged.partner_enabled,
          member_1: merged.member_1,
          member_2: merged.member_2,
          telegram_config: merged.telegram_config,
          updated_at: merged.updated_at
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (!error && data) {
        // Juga backup ke lokal
        writeLocalSettings(merged);
        return merged;
      }
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({
          household_name: merged.household_name,
          currency: merged.currency,
          low_fund_threshold: merged.low_fund_threshold,
          partner_enabled: merged.partner_enabled,
          member_1: merged.member_1,
          member_2: merged.member_2,
          telegram_config: merged.telegram_config,
          updated_at: merged.updated_at
        })
        .select()
        .single();

      if (!error && data) {
        writeLocalSettings(merged);
        return merged;
      }
    }
  } catch (err) {
    // Abaikan jika Supabase belum ada tabelnya
  }

  // Backup selalu ditulis ke lokal
  writeLocalSettings(merged);
  return merged;
}

/**
 * Mencocokkan Telegram User ID dengan profil anggota keluarga (member_1 atau member_2 jika partner aktif)
 */
export async function getMemberByTelegramId(telegramId: string | number): Promise<{
  id: string;
  name: string;
  role: string;
  actor: 'suami' | 'istri';
} | null> {
  const strId = String(telegramId).trim();
  const settings = await getSettings();

  if (settings.member_1.telegram_id && String(settings.member_1.telegram_id).trim() === strId) {
    return {
      id: settings.member_1.id,
      name: settings.member_1.name,
      role: settings.member_1.role,
      actor: 'suami'
    };
  }

  // Hanya periksa member 2 jika akun partner diaktifkan
  if (settings.partner_enabled && settings.member_2.telegram_id && String(settings.member_2.telegram_id).trim() === strId) {
    return {
      id: settings.member_2.id,
      name: settings.member_2.name,
      role: settings.member_2.role,
      actor: 'istri'
    };
  }

  return null;
}
