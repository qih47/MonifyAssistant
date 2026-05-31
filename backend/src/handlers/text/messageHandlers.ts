import { supabase } from '../../config/supabaseClient.js';
import { parseFinancialText } from '../../services/aiService.js';
import { parseTransactionManual } from '../../services/parsers.js';
import { getPocketButtons } from '../../helpers/buttons.js';
import { formatIDR } from '../../helpers/formatters.js';
import { generateNaturalResponse } from '../../helpers/naturalResponse.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';
import { handleListTagihan, handleBayarTagihan } from './billHandlers.js';
import { handleListCicilan, handleBayarCicilan } from './installmentHandlers.js';
import { handleCekSaldo } from './balanceHandlers.js';
import { handleRingkasan, handleLaporan } from './reportHandlers.js';
import { handleTransferAsset } from './assetHandlers.js';

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

    const laporanKeywords = ['laporan', 'export', 'csv', 'excel', 'download', 'kirim laporan', 'kirim file', 'laporan keuangan', 'laporan pengeluaran', 'laporan pemasukan', 'download laporan', 'riwayat transaksi', 'history', 'mutasi', 'rekap transaksi', 'laporan moni', 'export laporan', 'file laporan', 'kirim csv', 'kirim excel', 'bikinin laporan', 'buatin laporan', 'minta laporan', 'export data', 'download data'];
    if (laporanKeywords.some(k => pesan.includes(k))) return await handleLaporan(ctx);

    const saldoKeywords = ['cek saldo', 'saldo', 'lihat saldo', 'saldo gw', 'sisa saldo', 'sisa uang', 'cek duit', 'uang sekarang'];
    if (saldoKeywords.some(k => pesan.includes(k))) {
        const naturalReply = await generateNaturalResponse('User minta cek saldo.', userName);
        await ctx.reply(naturalReply);
        return await handleCekSaldo(ctx);
    }

    const ringkasanKeywords = ['ringkasan', 'rekap', 'rangkuman', 'summary', 'overview', 'ikhtisar', 'bulan ini', 'rangkum'];
    if (ringkasanKeywords.some(k => pesan.includes(k))) return await handleRingkasan(ctx);

    const helpKeywords = ['help', 'bantuan', 'fitur', 'bisa apa', 'perintah', 'command', 'apa aja', 'menu'];
    if (helpKeywords.some(k => pesan.includes(k))) {
        const helpMessage =
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🤖  *MONIFY FINANCE ASSISTANT* \n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Halo! Aku *Moni*, asisten keuangan pribadimu. Kamu bisa mencatat dan mengelola keuanganmu secara otomatis lewat chat biasa. Berikut fitur utama yang bisa aku lakukan:\n\n` +
            `📝 *1. CATAT TRANSAKSI (AI PARSER)*\n` +
            `Cukup ketik kalimat natural, Moni akan otomatis mendeteksi nominal, kategori, dan tipenya.\n` +
            `• 🛍️ *Pengeluaran:* \`Beli kopi starbucks 45rb\`\n` +
            `• 💵 *Pemasukan:* \`Gaji bulanan masuk 8.5jt\`\n` +
            `• 📸 *Struk/Nota:* Kirim foto struk belanjaanmu, Moni akan baca otomatis via OCR!\n\n` +
            `🎯 *2. MANAJEMEN TABUNGAN / IMPIAN*\n` +
            `Kelola alokasi dana khusus untuk barang impianmu.\n` +
            `• 📥 *Nabung:* \`Nabung Air Purifier 500rb\`\n` +
            `• 🔍 *Cek Target:* \`cek tabungan\` atau \`progres impian\`\n\n` +
            `💳 *3. TAGIHAN & CICILAN CONVENIENCE*\n` +
            `Moni bisa bantu kelola pos pengeluaran rutin.\n` +
            `• 🌐 *Tagihan:* \`/bayar wifi\` atau \`bayar kosan 1.2jt\`\n` +
            `• 🏍️ *Cicilan:* \`/cicil motor\` atau \`cicil mobil 2.5jt\`\n\n` +
            `📊 *4. MONITORING & LAPORAN*\n` +
            `Pantau kondisi kesehatan keuanganmu kapan saja.\n` +
            `• 💰 *Cek Saldo:* \`/saldo\` atau ketik \`cek saldo\`\n` +
            `• 📉 *Alokasi Budget:* \`cek budget bulan ini\`\n` +
            `• 📋 *Rekapitulasi:* \`/ringkasan\` atau ketik \`rekap\`\n` +
            `• 📁 *Ekspor Data:* \`/laporan\` atau \`export csv\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 *Tips:* Ketik perintah dengan santai, AI Moni akan berusaha memahaminya. Moni siap membantu 24/7! 🚀`;
        return await ctx.reply(helpMessage, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
        });
    }

    const cekTabunganKeywords = ['cek tabungan', 'progres impian', 'progres tabungan', 'target tabungan', 'lihat tabungan', 'list tabungan', 'celengan'];
    if (cekTabunganKeywords.some(k => pesan.includes(k))) {
        await ctx.reply('🔍 Menarik data target celengan keluarga dari database...');

        try {
            const { data: goals, error } = await supabase
                .from('saving_goals')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!goals || goals.length === 0) {
                return await ctx.reply('🎯 Belum ada target impian aktif yang tercatat di database nih, Cuy. Yuk buat target baru via Dashboard Web!');
            }

            let reportText = `━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 *PROGRESS TARGET CELENGAN KELUARGA* \n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            goals.forEach((g: any, idx: number) => {
                const current = Number(g.current_amount || 0);
                const target = Number(g.target_amount || 0);
                const progressPct = Math.min(Math.round((current / target) * 100), 100);
                const deadlineText = g.deadline
                    ? `📅 Tenggat: ${new Date(g.deadline).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`
                    : '📅 Tanpa Tenggat';

                reportText += `${idx + 1}. *${g.name}*\n`;
                reportText += `   💰 Progress: *${formatIDR(current)}* / ${formatIDR(target)} (*${progressPct}%*)\n`;
                reportText += `   ${deadlineText}\n\n`;
            });

            reportText += `━━━━━━━━━━━━━━━━━━━━━━━━\n🚀 Semangat alokasikan sisa saldo kantong bulanan lu berdua!`;
            return await ctx.replyWithMarkdown(reportText);
        } catch (err) {
            console.error('❌ Gagal mengambil list tabungan via Telegram:', err);
            return await ctx.reply('⚠️ Waduh, Moni gagal menarik data tabungan. Sila cek koneksi database Supabase lu.');
        }
    }

    const sapaanKeywords = ['hai', 'halo', 'hello', 'hi', 'woi', 'eh', 'p', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'test', 'tes', 'oy', 'oi', 'hallo', 'hy', 'yo', 'wow'];
    if (sapaanKeywords.some(k => pesan === k || pesan.startsWith(k + ' ') || pesan.endsWith(' ' + k))) {
        const naturalReply = await generateNaturalResponse(`User "${userName}" menyapa: "${pesanAsli}".`, userName);
        return await ctx.reply(naturalReply);
    }

    const tanyaKeywords = ['apa kabar', 'gimana', 'bagaimana', 'lagi apa', 'kamu siapa', 'lagi ngapain', 'sehat', 'baik'];
    if (tanyaKeywords.some(k => pesan.includes(k))) {
        const naturalReply = await generateNaturalResponse(`User tanya: "${pesanAsli}".`, userName);
        return await ctx.reply(naturalReply);
    }

    const punyaNominal = /\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i.test(pesan);
    const transaksiKeywords = /beli|bayar|jajan|makan|minum|belanja|transfer|masuk|gaji|bonus|topup|isi|pulsa|servis|bensin|parkir|nabung|tabungan|tabung/i.test(pesan);

    const transferKeywords = ['transfer ke', 'transfer dari', 'pindahin ke', 'pindah ke', 'kirim ke', 'tf ke'];
    if (transferKeywords.some(k => pesan.includes(k)) && punyaNominal) {
        return await handleTransferAsset(ctx, pesanAsli);
    }

    const isKemungkinanTransaksi = punyaNominal || transaksiKeywords;
    if (isKemungkinanTransaksi) {
        await ctx.reply('⏳ Sebentar, Moni proses transaksinya...');
        let hasilParse = null;

        try { hasilParse = await parseFinancialText(pesanAsli); } catch { }
        if (!hasilParse) {
            const manualResult = parseTransactionManual(pesanAsli);
            if (manualResult) hasilParse = manualResult as any;
        }

        if (hasilParse) {
            const { amount, description, type, actor: aiActor, category, merchant, transaction_date, is_saving_goal, goal_name } = hasilParse;
            const finalActor = aiActor === 'auto' ? ctx.state.actor : aiActor;
            const txId = (is_saving_goal ? 'sg' : 'tx') + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
            pendingTransactions.set(txId, {
                amount, actor: finalActor, description, type, timestamp: Date.now(),
                category, merchant, transaction_date, is_saving_goal, goal_name
            });

            const formattedAmount = formatIDR(amount);
            const actorEmojiPreview = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            const keyboardButtons = await getPocketButtons(txId);
            const dateText = new Date(transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            if (is_saving_goal && goal_name) {
                await ctx.reply(
                    `━━━━━━━━━━━━━━━━━━━\n🎯 *KONFIRMASI TARGET TABUNGAN*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📦 Impian: *${goal_name}*\n` +
                    `💰 Setoran: *${formattedAmount}*\n` +
                    `👤 Oleh: ${actorEmojiPreview}\n\n` +
                    `Pilih kantong dana sumber setoran tabungan:`,
                    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboardButtons } }
                );
            } else {
                const tipeText = type === 'income' ? 'Pemasukan' : type === 'expense' ? 'Pengeluaran' : 'Transfer';
                const tipeEmoji = type === 'income' ? '🟢' : type === 'expense' ? '🔴' : '🔵';

                await ctx.reply(
                    `━━━━━━━━━━━━━━━━━━━\n💳 *KONFIRMASI ALOKASI DANA*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📝 *${description}*\n` +
                    `💰 Nominal: *${formattedAmount}*\n` +
                    `🏬 Toko: *${merchant}*\n` +
                    `🏷️ Kategori: *${category.replace('_', ' ')}*\n` +
                    `📅 Tanggal: *${dateText}*\n` +
                    `${tipeEmoji} Tipe: *${tipeText}*\n` +
                    `👤 Oleh: ${actorEmojiPreview}\n\n` +
                    `Pilih sumber dana:`,
                    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboardButtons } }
                );
            }
            return;
        }

        await ctx.reply(
            `━━━━━━━━━━━━━━━━━━━\n🤔 *Moni tidak mengerti*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `Tidak dapat menemukan nominal transaksi.\n\n` +
            `📝 *Format yang benar:*\n` +
            `• \"Beli kopi 35rb\"\n` +
            `• \"Gaji masuk 5jt\"\n` +
            `• \"Nabung beli kulkas 700rb\"\n\n` +
            `💡 Ketik *help* untuk bantuan.`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const naturalReply = await generateNaturalResponse(`User berkata: "${pesanAsli}". Arahkan ke "help" jika tidak mengerti.`, userName);
    return await ctx.reply(naturalReply);
}
