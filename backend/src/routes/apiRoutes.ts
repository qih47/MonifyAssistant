import { Router, Request, Response } from 'express';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { 
  processInAppChatMessage, 
  confirmInAppTransaction, 
  cancelInAppTransaction 
} from '../services/chatAssistantService.js';
import { supabase } from '../config/supabaseClient.js';
import { Telegraf } from 'telegraf';

const router = Router();

// ==========================================
// 1. SETTINGS API (Keluarga & Konfigurasi)
// ==========================================

// GET /api/settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    console.error('❌ GET /api/settings error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

// PUT /api/settings
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Validasi ketat: Hanya boleh sepasang / maksimal 2 orang
    if (body.members && Array.isArray(body.members) && body.members.length > 2) {
      return res.status(400).json({
        success: false,
        error: 'Maksimal anggota keluarga adalah 2 orang (sepasang partner)!'
      });
    }

    const updated = await updateSettings(body);
    return res.status(200).json({
      success: true,
      message: 'Pengaturan berhasil diperbarui!',
      data: updated
    });
  } catch (error: any) {
    console.error('❌ PUT /api/settings error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

// POST /api/settings/test-telegram (Tes kirim notifikasi Telegram)
router.post('/settings/test-telegram', async (req: Request, res: Response) => {
  try {
    const { bot_token, chat_id, member_name } = req.body;
    if (!bot_token || !chat_id) {
      return res.status(400).json({ success: false, error: 'bot_token dan chat_id wajib diisi!' });
    }

    const tempBot = new Telegraf(bot_token);
    await tempBot.telegram.sendMessage(
      chat_id,
      `🔔 *Tes Koneksi Monify Sukses!*\n\nHalo ${member_name || 'Partner'}! Bot Telegram berhasil terhubung dengan aplikasi Monify kamu. 🚀`,
      { parse_mode: 'Markdown' }
    );

    return res.status(200).json({ success: true, message: 'Pesan tes berhasil dikirim ke Telegram!' });
  } catch (error: any) {
    console.error('❌ Test Telegram error:', error);
    return res.status(500).json({ success: false, error: 'Gagal mengirim pesan ke Telegram: ' + (error.message || '') });
  }
});

// ==========================================
// 2. IN-APP CHATBOT ASSISTANT API
// ==========================================

// POST /api/chat/message
router.post('/chat/message', async (req: Request, res: Response) => {
  try {
    const { message, imageBase64, mimeType, actorId, actorName } = req.body;
    const response = await processInAppChatMessage({
      message,
      imageBase64,
      mimeType,
      actorId,
      actorName
    });

    return res.status(200).json({ success: true, data: response });
  } catch (error: any) {
    console.error('❌ POST /api/chat/message error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal memproses pesan AI' });
  }
});

// POST /api/chat/confirm
router.post('/chat/confirm', async (req: Request, res: Response) => {
  try {
    const { draftId, pocketId } = req.body;
    if (!draftId || !pocketId) {
      return res.status(400).json({ success: false, error: 'draftId dan pocketId wajib diisi!' });
    }

    const result = await confirmInAppTransaction(draftId, Number(pocketId));
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ POST /api/chat/confirm error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal mengonfirmasi transaksi' });
  }
});

// POST /api/chat/cancel
router.post('/chat/cancel', async (req: Request, res: Response) => {
  try {
    const { draftId } = req.body;
    if (!draftId) {
      return res.status(400).json({ success: false, error: 'draftId wajib diisi!' });
    }

    const result = cancelInAppTransaction(draftId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ POST /api/chat/cancel error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal membatalkan transaksi' });
  }
});

// ==========================================
// 3. FINANCIAL RESOURCES HELPER (Ready for Mobile)
// ==========================================

// GET /api/pockets
router.get('/pockets', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('pockets')
      .select('id, name, display_name, current_balance, target_budget, icon, ownership')
      .order('id', { ascending: true });

    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/assets
router.get('/assets', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('id, name, balance, gold_weight_gram, category, ownership')
      .order('id', { ascending: true });

    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
