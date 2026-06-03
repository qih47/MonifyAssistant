import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Telegraf } from 'telegraf';
import { supabase } from './config/supabaseClient.js';
import { sendTransactionEmailNotification } from './services/notificationService.js';
import { setBotInstance, startCronJobs, checkDueBills, checkDueInstallments } from './services/cronService.js';
import { checkAndNotifyLowFund } from './services/lowFundService.js';
import { initBot } from './bot/init.js';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
    console.error("❌ ERROR: TELEGRAM_BOT_TOKEN gak ketemu di .env!");
    process.exit(1);
}

const bot = new Telegraf(botToken);

let ALLOWED_USERS: Record<string, string> = {};
try {
    const envUsers = process.env.ALLOWED_USERS;
    if (envUsers) {
        ALLOWED_USERS = JSON.parse(envUsers);
    } else {
        console.error("❌ ERROR: ALLOWED_USERS tidak ditemukan di .env!");
        process.exit(1);
    }
} catch (e) {
    console.error("❌ ERROR: Format JSON ALLOWED_USERS di .env salah!");
    process.exit(1);
}

const ALLOWED_CHAT_IDS = Object.keys(ALLOWED_USERS);

// pendingTransactions state moved to state/pendingTransactions.ts

// Middleware and handler registrations moved to bot/init.ts

// ==========================================
// COMMAND /start
// ==========================================
bot.start((ctx) => {
    // 📌 PERBAIKAN KRITIS: Kunci penentuan aktor secara presisi dari session state middleware
    // Berikan fallback 'suami' jika inisialisasi state awal Telegram mendeteksi delay/null
    const finalActor = ctx.state.actor || 'suami';
    const actorEmojiEmoji = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
    
    ctx.reply(
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🤖 *Moni - Asisten Keuangan*\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Halo ${actorEmojiEmoji}! 👋\n\n` +
        `📝 *Fitur Utama:*\n` +
        `• *Catat transaksi:* "Beli kopi 35rb"\n` +
        `• *Cek saldo:* /saldo atau "saldo"\n` +
        `• *Ringkasan:* /ringkasan atau "rekap"\n` +
        `• *Laporan CSV:* /laporan atau "export"\n` +
        `• *Bayar tagihan:* /bayar [nama]\n` +
        `• *Bayar cicilan:* /cicil [nama]\n` +
        `• *Foto struk:* Kirim foto langsung\n\n` +
        `Aktor: *${actorEmojiEmoji}*`,
        { parse_mode: 'Markdown' }
    );
});

// formatters, icon mapper, and naturalResponse moved to helpers/*

// Initialize bot middleware, handlers and commands
initBot(bot, ALLOWED_CHAT_IDS, ALLOWED_USERS);

// ==========================================
// START BOT & CRON (AUTO-DETECT MODE)
// ==========================================
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.KOYEB_URL;

console.log(`🤖 Menghubungkan ke Bot Telegram (${isProduction ? 'Webhook' : 'Long Polling'})...`);

if (isProduction) {
  // 🔥 PRODUCTION MODE - Webhook (Koyeb)
  const KOYEB_URL = (process.env.KOYEB_URL || '').replace(/\/$/, '');
  console.log(`🔗 Webhook URL: ${KOYEB_URL}/api/telegram-webhook`);
  
  bot.telegram.setWebhook(`${KOYEB_URL}/api/telegram-webhook`)
    .then(() => console.log('✅ Webhook terpasang!'))
    .catch((err) => console.error('❌ Gagal set webhook:', err));
  
  app.post('/api/telegram-webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
  });
  
  setBotInstance(bot);
  startCronJobs();
} else {
  // 🔥 DEVELOPMENT MODE - Long Polling (localhost)
  bot.launch()
    .then(() => {
      console.log('✅ Bot Telegram aktif (Long Polling)!');
      setBotInstance(bot);
      startCronJobs();
    })
    .catch((err) => console.error('❌ Gagal:', err));
}

app.get('/', (req, res) => res.send('Backend Running! 🚀'));

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint khusus untuk memicu notifikasi dari Cron-Job.org (Bypass Sleep Free Tier)
app.get('/api/trigger-bill-check', async (req, res) => {
    try {
        console.log("⏰ Pemicu eksternal terdeteksi: Memulai pengecekan tagihan dan cicilan harian...");

        // Eksekusi fungsi pengecekan tagihan
        if (typeof checkDueBills === 'function') {
            await checkDueBills();
        }

        // Eksekusi fungsi pengecekan cicilan
        if (typeof checkDueInstallments === 'function') {
            await checkDueInstallments();
        }

        return res.status(200).json({
            success: true,
            message: "Notifikasi tagihan & cicilan berhasil diproses dan dikirim ke Telegram!"
        });
    } catch (error) {
        console.error("❌ Eror saat memicu notifikasi keuangan:", error);
        return res.status(500).json({
            success: false,
            error: "Internal Server Error saat memproses notifikasi"
        });
    }
});
app.listen(PORT, () => console.log(`Server di http://localhost:${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));