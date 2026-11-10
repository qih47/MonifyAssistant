-- ==============================================================================
-- TABEL: app_settings (PENGATURAN KELUARGA & SISTEM DINAMIS - MAKSIMAL 2 PERSON)
-- Jalankan query ini di SQL Editor Supabase Dashboard Anda.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_name VARCHAR(100) NOT NULL DEFAULT 'Keluarga Bahagia',
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    low_fund_threshold NUMERIC(15, 2) DEFAULT 100000,
    
    -- Slot Anggota 1 (Maksimal 2 Anggota / Sepasang)
    member_1 JSONB NOT NULL DEFAULT '{
        "id": "member_1",
        "name": "Qisthi",
        "role": "Suami",
        "telegram_id": "",
        "telegram_chat_id": "",
        "color": "emerald"
    }'::jsonb,
    
    -- Slot Anggota 2 (Maksimal 2 Anggota / Sepasang)
    member_2 JSONB NOT NULL DEFAULT '{
        "id": "member_2",
        "name": "Gita",
        "role": "Istri",
        "telegram_id": "",
        "telegram_chat_id": "",
        "color": "violet"
    }'::jsonb,
    
    -- Konfigurasi Bot Telegram Dinamis (Opsional)
    telegram_config JSONB NOT NULL DEFAULT '{
        "enabled": false,
        "bot_token": "",
        "bot_username": ""
    }'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert record default pertama jika tabel masih kosong
INSERT INTO public.app_settings (household_name, currency, low_fund_threshold, member_1, member_2, telegram_config)
SELECT 
    'Keluarga Bahagia',
    'IDR',
    100000,
    '{"id": "member_1", "name": "Qisthi", "role": "Suami", "telegram_id": "", "telegram_chat_id": "", "color": "emerald"}'::jsonb,
    '{"id": "member_2", "name": "Gita", "role": "Istri", "telegram_id": "", "telegram_chat_id": "", "color": "violet"}'::jsonb,
    '{"enabled": false, "bot_token": "", "bot_username": ""}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- Enable RLS & Izinkan read/write untuk service role dan authenticated user
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read app_settings" 
ON public.app_settings FOR SELECT 
USING (true);

CREATE POLICY "Allow full access app_settings" 
ON public.app_settings FOR ALL 
USING (true)
WITH CHECK (true);
