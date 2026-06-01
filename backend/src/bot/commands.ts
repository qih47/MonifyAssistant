import { Telegraf } from 'telegraf';
import { handleListTagihan, handleBayarTagihan } from '../handlers/text/billHandlers.js';
import { handleListCicilan, handleBayarCicilan } from '../handlers/text/installmentHandlers.js';
import { handleCekSaldo } from '../handlers/text/balanceHandlers.js';
import { handleRingkasan, handleLaporan } from '../handlers/text/reportHandlers.js';

export function registerTextCommands(bot: Telegraf<any>) {
    bot.command('saldo', async (ctx) => { await ctx.reply('🔍 Memeriksa saldo...'); return await handleCekSaldo(ctx); });
    bot.command('ringkasan', async (ctx) => { return await handleRingkasan(ctx); });
    bot.command('bayar', async (ctx) => {
        const input = ctx.message.text.replace('/bayar', '').trim();
        if (!input) return await handleListTagihan(ctx);
        return await handleBayarTagihan(ctx, input);
    });
    bot.command('cicil', async (ctx) => {
        const input = ctx.message.text.replace('/cicil', '').trim();
        if (!input) return await handleListCicilan(ctx);
        return await handleBayarCicilan(ctx, input);
    });
    bot.command('laporan', async (ctx) => { return await handleLaporan(ctx); });
    bot.command('help', async (ctx) => {
        return await ctx.reply(
            `━━━━━━━━━━━━━━━━━━━\n🤖 *MONI - ASISTEN KEUANGAN* \n━━━━━━━━━━━━━━━━━━━\n\n` +
            `💰 *1. CATAT TRANSAKSI NATURAL*\nKetik kalimat santai, AI otomatis parse.\n• "Beli nasi padang 35rb"\n• "Gaji masuk 8jt"\n• "Transfer ke gopay 200rb"\n\n` +
            `📸 *2. OCR MULTI-DOKUMEN*\nKirim foto struk, token listrik, tagihan.\nAI baca nominal & kategori otomatis.\n\n` +
            `🧾 *3. BAYAR TAGIHAN*\n/bayar [nama] atau "bayar wifi"\nKonfirmasi sekali-klik via button.\n\n` +
            `🏠 *4. BAYAR CICILAN*\n/cicil [nama] atau "cicil motor"\nTrack progress cicilan bulanan.\n\n` +
            `📊 *5. CEK SALDO REAL-TIME*\n/saldo atau "cek saldo"\nLaporan lengkap pockets + assets.\nTermasuk emas (gram) & rekening.\n\n` +
            `📁 *6. EXPORT DATA CSV*\n/laporan atau "export"\nDownload riwayat transaksi.\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n🤖 Moni siap bantu 24/7! 🚀`,
            { parse_mode: 'Markdown' }
        );
    });
}
