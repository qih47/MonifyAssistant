/**
 * Bot Commands Registration
 * Registers all text commands (/start, /saldo, /bayar, etc.)
 */

import { Telegraf } from 'telegraf';
import { handleListTagihan, handleBayarTagihan } from '../handlers/text/billHandlers.js';
import { handleListCicilan, handleBayarCicilan } from '../handlers/text/installmentHandlers.js';
import { handleCekSaldo } from '../handlers/text/balanceHandlers.js';
import { handleRingkasan, handleLaporan } from '../handlers/text/reportHandlers.js';
import { handleCekTabungan } from '../handlers/text/savingGoalHandlers.js';

export function registerCommands(bot: Telegraf<any>) {
    // /saldo - Check balance
    bot.command('saldo', async (ctx) => { 
        await ctx.reply('🔍 Memeriksa saldo...'); 
        return await handleCekSaldo(ctx); 
    });
    
    // /ringkasan - Monthly summary
    bot.command('ringkasan', async (ctx) => { 
        return await handleRingkasan(ctx); 
    });
    
    // /bayar - Pay bills
    bot.command('bayar', async (ctx) => {
        const input = ctx.message.text.replace('/bayar', '').trim();
        if (!input) return await handleListTagihan(ctx);
        return await handleBayarTagihan(ctx, input);
    });
    
    // /cicil - Pay installments
    bot.command('cicil', async (ctx) => {
        const input = ctx.message.text.replace('/cicil', '').trim();
        if (!input) return await handleListCicilan(ctx);
        return await handleBayarCicilan(ctx, input);
    });
    
    // /laporan - Export CSV report
    bot.command('laporan', async (ctx) => { 
        return await handleLaporan(ctx); 
    });
    
    // /tabungan - Check saving goals
    bot.command('tabungan', async (ctx) => {
        return await handleCekTabungan(ctx);
    });
    
    // /help - Show help menu
    bot.command('help', async (ctx) => {
        return await ctx.reply(
            `━━━━━━━━━━━━━━━━━━━\n🤖 *MONI - ASISTEN KEUANGAN*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `💰 *Cek Saldo*\n/saldo atau "saldo"\n\n` +
            `📊 *Ringkasan Bulanan*\n/ringkasan atau "rekap"\n\n` +
            `🧾 *Bayar Tagihan*\n/bayar [nama] atau "bayar wifi"\n\n` +
            `🏠 *Bayar Cicilan*\n/cicil [nama] atau "cicil motor"\n\n` +
            `📁 *Laporan CSV*\n/laporan atau "export"\n\n` +
            `🎯 *Cek Tabungan*\n/tabungan atau "cek tabungan"\n\n` +
            `📝 *Catat Transaksi*\n"Beli kopi 35rb"\n\n` +
            `📸 *Struk Belanja*\nKirim foto langsung\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n🤖 Moni siap bantu 24/7! 🚀`,
            { parse_mode: 'Markdown' }
        );
    });
}
