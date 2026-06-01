import { handleListTagihan, handleBayarTagihan } from './billHandlers.js';
import { handleListCicilan, handleBayarCicilan } from './installmentHandlers.js';
import { handleCekSaldo } from './balanceHandlers.js';
import { handleRingkasan, handleLaporan } from './reportHandlers.js';
import { handleTransferAsset } from './assetHandlers.js';
import { handleSavingGoalOverview } from './savingGoalHandlers.js';
import { handleFinancialText } from './transactionHandlers.js';
import { generateNaturalResponse } from '../../helpers/naturalResponse.js';
import { matchesAnyKeyword, isPotentialTransaction } from '../../helpers/validators.js';
import { laporanKeywords, saldoKeywords, ringkasanKeywords, helpKeywords, cekTabunganKeywords, sapaanKeywords, tanyaKeywords, transferKeywords } from '../../constants/keywords.js';

export async function handleTextMessage(ctx: any) {
    const pesanAsli = ctx.message.text;
    const pesan = pesanAsli.toLowerCase().trim();
    const userName = ctx.state.actor === 'suami' ? 'Qisthi' : 'Gita';

    if (pesan.startsWith('/')) return;

    if (pesan === 'cicil' || pesan === 'cicilan' || pesan === 'bayar cicilan') return await handleListCicilan(ctx);
    if (pesan.startsWith('cicil ') || pesan.startsWith('bayar cicilan ')) {
        return await handleBayarCicilan(ctx, pesan.replace(/^(cicil|bayar cicilan)\s+/, '').trim());
    }

    if (pesan === 'bayar' || pesan === 'bayarin' || pesan === 'bayar tagihan' || pesan === 'tagihan') return await handleListTagihan(ctx);
    if (pesan.startsWith('bayar ') || pesan.startsWith('bayarin ')) {
        const namaTagihan = pesan.replace(/^bayar(in)?\s+/, '').trim();
        if (namaTagihan === 'cicilan') return await handleListCicilan(ctx);
        return await handleBayarTagihan(ctx, namaTagihan);
    }

    if (matchesAnyKeyword(pesan, laporanKeywords)) return await handleLaporan(ctx);

    if (saldoKeywords.some(k => pesan.includes(k))) {
        return await handleCekSaldo(ctx);
    }

    if (matchesAnyKeyword(pesan, ringkasanKeywords)) return await handleRingkasan(ctx);

    if (matchesAnyKeyword(pesan, helpKeywords)) {
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
    }

    if (matchesAnyKeyword(pesan, cekTabunganKeywords)) {
        return await handleSavingGoalOverview(ctx);
    }

    if (sapaanKeywords.some(k => pesan === k || pesan.startsWith(k + ' ') || pesan.endsWith(' ' + k))) {
        const naturalReply = await generateNaturalResponse(`User "${userName}" menyapa: "${pesanAsli}".`, userName);
        return await ctx.reply(naturalReply);
    }

    if (matchesAnyKeyword(pesan, tanyaKeywords)) {
        const naturalReply = await generateNaturalResponse(`User tanya: "${pesanAsli}".`, userName);
        return await ctx.reply(naturalReply);
    }

    if (matchesAnyKeyword(pesan, transferKeywords) && isPotentialTransaction(pesanAsli)) {
        return await handleTransferAsset(ctx, pesanAsli);
    }

    if (await handleFinancialText(ctx, pesanAsli, userName)) {
        return;
    }

    const naturalReply = await generateNaturalResponse(`User berkata: "${pesanAsli}". Arahkan ke "help" jika tidak mengerti.`, userName);
    return await ctx.reply(naturalReply);
}
