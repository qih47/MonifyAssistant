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
            `━━━━━━━━━━━━━━━━━━━\n🤖 *MONI - ASISTEN KEUANGAN*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `💰 *Cek Saldo*\n/saldo atau "saldo"\n\n` +
            `📊 *Ringkasan Bulanan*\n/ringkasan atau "rekap"\n\n` +
            `🧾 *Bayar Tagihan*\n/bayar [nama] atau "bayar wifi"\n\n` +
            `🏠 *Bayar Cicilan*\n/cicil [nama] atau "cicil motor"\n\n` +
            `📁 *Laporan CSV*\n/laporan atau "export"\n\n` +
            `📝 *Catat Transaksi*\n"Beli kopi 35rb"\n\n` +
            `📸 *Struk Belanja*\nKirim foto langsung\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n🤖 Moni siap bantu 24/7! 🚀`,
            { parse_mode: 'Markdown' }
        );
    });
}
