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
        const helpMessage =
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🤖  *MONIFY FINANCE ASSISTANT* \n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Halo! Aku *Moni*, asisten keuangan pribadimu. Kamu bisa mencatat dan mengelola keuanganmu secara otomatis lewat chat biasa. Berikut fitur utama yang bisa aku lakukan:\n\n` +
            `📝 *1. CATAT TRANSAKSI (AI PARSER)*\n` +
            `Cukup ketik kalimat natural, Moni akan otomatis mendeteksi nominal, kategori, dan tipenya.\n` +
            `• 🛍️ *Pengeluaran:* \`Beli kopi starbucks 45rb\`\n` +
            `• 💵 *Pemasukan:* \`Gaji bulanan masuk 8.5jt\`\n` +
            `• 📸 *Struk/Nota:* Kirim foto struk belanjaanmu, Moni akan baca otomatis via OCR!\n` +
            `• 💳 *Transfer Antar Asset:* \`Transfer ke GoPay 100rb\`\n\n` +
            `🎯 *2. MANAJEMEN TABUNGAN / IMPIAN*\n` +
            `Kelola alokasi dana khusus untuk barang impianmu.\n` +
            `• 📥 *Nabung:* \`Nabung Air Purifier 500rb\`\n` +
            `• 🔍 *Cek Target:* \`cek tabungan\` atau \`progres impian\`\n\n` +
            `💳 *3. TAGIHAN & CICILAN CONVENIENCE*\n` +
            `Moni bisa bantu kelola pos pengeluaran rutin.\n` +
            `• 🌐 *Tagihan:* \`/bayar wifi\` atau \`bayar kosan 1.2jt\` atau kirim foto tagihan\n` +
            `• 🏍️ *Cicilan:* \`/cicil motor\` atau \`cicil mobil 2.5jt\` atau kirim foto slip cicilan\n\n` +
            `📊 *4. MONITORING & LAPORAN*\n` +
            `Pantau kondisi kesehatan keuanganmu kapan saja.\n` +
            `• 💰 *Cek Saldo:* \`/saldo\` atau ketik \`cek saldo\`\n` +
            `• 📋 *Rekapitulasi Bulanan:* \`/ringkasan\` atau ketik \`rekap\`\n` +
            `• 📁 *Ekspor Data:* \`/laporan\` atau \`export csv\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 *Tips:* Ketik perintah dengan santai, AI Moni akan berusaha memahaminya. Moni siap membantu 24/7! 🚀`;
        return await ctx.reply(helpMessage, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
        });
    });
}
