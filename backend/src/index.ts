import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import { parseFinancialText, parseFinancialImage, getAIStatus } from './services/aiService.js';
import { supabase } from './config/supabaseClient.js';
import { Readable } from 'stream';
import { sendTransactionEmailNotification } from './services/notificationService.js';
import { setBotInstance, startCronJobs } from './services/cronService.js';

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

bot.use(async (ctx, next) => {
    const chatId = (ctx.chat?.id || ctx.message?.chat.id || ctx.myChatMember?.chat.id)?.toString();
    const username = ctx.from?.username || 'Unknown';
    console.log(`📩 Update masuk | Chat ID: ${chatId} | Username: ${username} | Type: ${ctx.updateType}`);

    if (!chatId || !ALLOWED_CHAT_IDS.includes(chatId)) {
        if (ctx.updateType === 'message') {
            try {
                await ctx.reply("🔒 Maaf, bot ini bersifat privat dan hanya bisa digunakan oleh pemilik.");
            } catch (err) {
                console.log(`⚠️ Gagal kirim pesan blokir ke ${chatId}`);
            }
        }
        return;
    }

    ctx.state.actor = ALLOWED_USERS[chatId as keyof typeof ALLOWED_USERS] || 'suami';

    if (ctx.updateType === 'message' && ctx.message) {
        return next();
    }

    console.log(`ℹ️ Update tipe [${ctx.updateType}] diabaikan.`);
    return;
});

bot.start((ctx) => {
    const actorEmoji = ctx.state.actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
    ctx.reply(
        `Halo ${actorEmoji}! 👋\n\n` +
        `🤖 *Moni* siap membantu kamu!\n\n` +
        `📝 *Fitur Utama:*\n` +
        `• Chat transaksi: "Beli kopi 35rb pake jajan qisthi"\n` +
        `• Cek saldo: /saldo atau "cek saldo"\n` +
        `• Ringkasan bulanan: /ringkasan atau "ringkasan"\n` +
        `• Bayar tagihan: /bayar atau "bayar wifi"\n` +
        `• Bayar cicilan: /cicil atau "bayar cicilan motor"\n` +
        `• Laporan CSV: /laporan atau "laporan keuangan"\n` +
        `• Foto struk: Kirim foto struk belanja\n` +
        `• Ngobrol santai: "Hai Moni!" atau "Apa kabar?"\n\n` +
        `Aktor terdeteksi: *${ctx.state.actor}*`,
        { parse_mode: 'Markdown' }
    );
});

// ==========================================
// HELPER: Format Rupiah
// ==========================================
const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

// ==========================================
// HELPER: List Tagihan Unpaid
// ==========================================
async function handleListTagihan(ctx: any) {
    try {
        const { data: bills, error } = await supabase
            .from('bills')
            .select('name, amount, due_date')
            .eq('status', 'unpaid')
            .order('due_date', { ascending: true });

        if (error) throw error;

        if (!bills || bills.length === 0) {
            return ctx.reply("✅ Ga ada tagihan pending, Cuy! Aman terkendali.");
        }

        let listText = "📋 **Daftar Tagihan Belum Dibayar:**\n\n";
        bills.forEach((b, i) => {
            const dueDate = b.due_date
                ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                : '?';
            listText += `${i + 1}. *${b.name}* — ${formatIDR(Number(b.amount))} (Jatuh tempo: ${dueDate})\n`;
        });
        listText += `\nKetik \`bayar [nama tagihan]\` buat bayar.\nContoh: \`bayar wifi\``;

        await ctx.replyWithMarkdown(listText);
    } catch (err) {
        console.error("❌ Gagal list tagihan:", err);
        await ctx.reply("⚠️ Gagal narik daftar tagihan, Cuy.");
    }
}

// ==========================================
// HELPER: List Cicilan Aktif
// ==========================================
async function handleListCicilan(ctx: any) {
    try {
        const { data: installments, error } = await supabase
            .from('installments')
            .select('name, monthly_amount, paid_months, tenor_months')
            .order('name', { ascending: true });

        if (error) throw error;

        if (!installments || installments.length === 0) {
            return ctx.reply("✅ Ga ada cicilan aktif, Cuy! Aman terkendali.");
        }

        let listText = "🏠 **Daftar Cicilan Aktif:**\n\n";
        let adaCicilan = false;

        installments.forEach((i, idx) => {
            const sisaBulan = Number(i.tenor_months) - Number(i.paid_months);
            if (sisaBulan > 0) {
                adaCicilan = true;
                listText += `${idx + 1}. *${i.name}* — ${formatIDR(Number(i.monthly_amount))}/bulan (Progress: ${i.paid_months}/${i.tenor_months})\n`;
            }
        });

        if (!adaCicilan) {
            return ctx.reply("🎉 Semua cicilan udah lunas, Cuy! Ga ada yang perlu dibayar.");
        }

        listText += `\nKetik \`cicil [nama cicilan]\` buat bayar.\nContoh: \`cicil motor\``;

        await ctx.replyWithMarkdown(listText);
    } catch (err) {
        console.error("❌ Gagal list cicilan:", err);
        await ctx.reply("⚠️ Gagal narik daftar cicilan, Cuy.");
    }
}

// ==========================================
// HELPER: Cek Saldo
// ==========================================
async function handleCekSaldo(ctx: any) {
    try {
        const { data: pockets, error } = await supabase
            .from('pockets')
            .select('name, current_balance, ownership');

        if (error) throw error;
        if (!pockets || pockets.length === 0) {
            return await ctx.reply("⚠️ Belum ada data kantong anggaran di database.");
        }

        let saldoBersama = 0, saldoQisthi = 0, saldoGita = 0, detailText = "";

        pockets.forEach(p => {
            const balance = Number(p.current_balance || 0);
            if (p.ownership === 'bersama') saldoBersama += balance;
            else if (p.ownership === 'suami') saldoQisthi += balance;
            else if (p.ownership === 'istri') saldoGita += balance;

            const cleanName = p.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            detailText += `• ${cleanName}: *${formatIDR(balance)}*\n`;
        });

        const totalSemua = saldoBersama + saldoQisthi + saldoGita;

        const reportText = `
💰 **LAPORAN SALDO REAL-TIME** 💰
━━━━━━━━━━━━━━━━━━━
🌐 **Kantong Bersama :** *${formatIDR(saldoBersama)}*
🧑 **Kantong Qisthi   :** *${formatIDR(saldoQisthi)}*
👩 **Kantong Gita      :** *${formatIDR(saldoGita)}*
━━━━━━━━━━━━━━━━━━━
📊 **Total Aset Dana  :** *${formatIDR(totalSemua)}*

📋 *Breakdown Detail Kantong:*
${detailText}
━━━━━━━━━━━━━━━━━━━
🤖 *Moni • Data real-time dari database.*
        `;
        await ctx.replyWithMarkdown(reportText);
    } catch (err) {
        console.error("❌ Gagal load saldo:", err);
        await ctx.reply("⚠️ Waduh, gagal narik data saldo, Cuy.");
    }
}

// ==========================================
// HELPER: Ringkasan Bulanan (DENGAN CICILAN)
// ==========================================
async function handleRingkasan(ctx: any) {
    try {
        await ctx.reply("📊 Lagi nyusun ringkasan keuangan bulan ini, bentar ya...");

        const sekarang = new Date();
        const awalBulan = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1).toISOString();
        const akhirBulan = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const bulanTeks = sekarang.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

        // 1. Arus Kas
        const { data: txData, error: txError } = await supabase
            .from('transactions')
            .select('amount, type, actor')
            .gte('created_at', awalBulan)
            .lte('created_at', akhirBulan);

        if (txError) throw txError;

        let totalPemasukan = 0, totalPengeluaran = 0;
        let pengeluaranQisthi = 0, pengeluaranGita = 0, pengeluaranBersama = 0;

        txData?.forEach(tx => {
            if (tx.type === 'income') totalPemasukan += Number(tx.amount);
            else if (tx.type === 'expense') {
                totalPengeluaran += Number(tx.amount);
                if (tx.actor === 'suami') pengeluaranQisthi += Number(tx.amount);
                else if (tx.actor === 'istri') pengeluaranGita += Number(tx.amount);
                else pengeluaranBersama += Number(tx.amount);
            }
        });

        // 2. Tagihan Unpaid
        const { data: bills } = await supabase
            .from('bills')
            .select('name, amount, due_date, status')
            .eq('status', 'unpaid')
            .order('due_date', { ascending: true });

        let tagihanText = "", totalTagihan = 0;
        if (bills && bills.length > 0) {
            bills.forEach(b => {
                totalTagihan += Number(b.amount);
                const dueDate = b.due_date ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '?';
                tagihanText += `• ${b.name}: *${formatIDR(Number(b.amount))}* (Jatuh tempo: ${dueDate})\n`;
            });
        } else {
            tagihanText = "✅ Tidak ada tagihan pending.\n";
        }

        // 3. Cicilan Kredit (installments)
        const { data: installments } = await supabase
            .from('installments')
            .select('name, total_amount, monthly_amount, paid_months, tenor_months, down_payment');

        let cicilanText = "", totalCicilanBulanan = 0;
        if (installments && installments.length > 0) {
            installments.forEach(i => {
                const sisaBulan = Number(i.tenor_months) - Number(i.paid_months);
                const cicilanBulanIni = Number(i.monthly_amount);
                totalCicilanBulanan += cicilanBulanIni;
                const totalDibayar = Number(i.down_payment) + (Number(i.paid_months) * cicilanBulanIni);
                const sisaTotal = Number(i.total_amount) - totalDibayar;

                cicilanText += `• ${i.name}: *${formatIDR(cicilanBulanIni)}/bulan*\n`;
                cicilanText += `  └ Progress: ${i.paid_months}/${i.tenor_months} bulan | Sisa: *${formatIDR(sisaTotal)}*\n`;
            });
        } else {
            cicilanText = "✅ Tidak ada cicilan kredit.\n";
        }

        // 4. Saldo Kantong
        const { data: pockets } = await supabase.from('pockets').select('name, current_balance');
        let saldoText = "", totalSaldo = 0;
        pockets?.forEach(p => {
            const balance = Number(p.current_balance || 0);
            totalSaldo += balance;
            const cleanName = p.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            saldoText += `• ${cleanName}: *${formatIDR(balance)}*\n`;
        });

        const totalKewajiban = totalTagihan + totalCicilanBulanan;
        const sisaSetelahBayar = totalSaldo - totalKewajiban;

        const ringkasan = `
📊 **RINGKASAN KEUANGAN** 📊
*${bulanTeks}*
━━━━━━━━━━━━━━━━━━━

💰 **ARUS KAS:**
🟢 Pemasukan: *${formatIDR(totalPemasukan)}*
🔴 Pengeluaran: *${formatIDR(totalPengeluaran)}*
📈 Selisih: *${formatIDR(totalPemasukan - totalPengeluaran)}*

👤 **PENGELUARAN:**
🧑 Qisthi: *${formatIDR(pengeluaranQisthi)}*
👩 Gita: *${formatIDR(pengeluaranGita)}*
🌐 Bersama: *${formatIDR(pengeluaranBersama)}*

💼 **SALDO:**
${saldoText}
💵 Total: *${formatIDR(totalSaldo)}*

📋 **TAGIHAN PENDING:**
${tagihanText}

🏠 **CICILAN KREDIT:**
${cicilanText}

⚠️ **TOTAL KEWAJIBAN:** *${formatIDR(totalKewajiban)}*
💰 **SISA SETELAH BAYAR:** *${formatIDR(sisaSetelahBayar)}*
${sisaSetelahBayar < 0 ? '⚠️ PERHATIAN: Saldo tidak cukup!' : '✅ Saldo cukup.'}
━━━━━━━━━━━━━━━━━━━
🤖 *Moni • Ringkasan real-time.*
        `;

        await ctx.replyWithMarkdown(ringkasan);

    } catch (err) {
        console.error("❌ Gagal ringkasan:", err);
        await ctx.reply("⚠️ Gagal nyusun ringkasan, Cuy.");
    }
}

// ==========================================
// HELPER: Bayar Tagihan (DENGAN KONFIRMASI)
// ==========================================
async function handleBayarTagihan(ctx: any, namaTagihan: string) {
    try {
        const { data: bills, error } = await supabase
            .from('bills')
            .select('*')
            .ilike('name', `%${namaTagihan}%`)
            .eq('status', 'unpaid');

        if (error) throw error;

        if (!bills || bills.length === 0) {
            return await handleListTagihan(ctx);
        }

        if (bills.length > 1) {
            let listText = `🤔 Ada beberapa tagihan yang mirip nih:\n\n`;
            bills.forEach((b, idx) => {
                const dueDate = b.due_date
                    ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                    : '?';
                listText += `${idx + 1}. *${b.name}* — ${formatIDR(Number(b.amount))} (Jatuh tempo: ${dueDate})\n`;
            });
            listText += `\nKetik lebih spesifik ya, Cuy!\nContoh: \`bayar wifi biznet\` atau \`bayar listrik pln\``;
            return await ctx.replyWithMarkdown(listText);
        }

        const bill = bills[0];
        const amount = Number(bill.amount);
        const actor = ctx.state.actor;
        const encodedName = encodeURIComponent(bill.name);

        await ctx.reply(
            `🧾 **Konfirmasi Bayar Tagihan**\n\n` +
            `📝 *${bill.name}*\n` +
            `💰 Nominal: *${formatIDR(amount)}*\n` +
            `👤 Eksekutor: ${actor === 'suami' ? '🧑 Qisthi' : '👩 Gita'}\n\n` +
            `Mau potong dari kantong mana nih?`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌐 Kantong Bersama', callback_data: `paybill:${amount}:${actor}:operasional_utama:${encodedName}:${bill.id}` }],
                        [{ text: '🧑 Jajan Qisthi', callback_data: `paybill:${amount}:${actor}:jajan_qisthi:${encodedName}:${bill.id}` }],
                        [{ text: '👩 Jajan Gita', callback_data: `paybill:${amount}:${actor}:jajan_gita:${encodedName}:${bill.id}` }],
                        [{ text: '❌ Batal', callback_data: `cancel_bill` }]
                    ]
                }
            }
        );

    } catch (err) {
        console.error("❌ Gagal bayar tagihan:", err);
        await ctx.reply("⚠️ Error pas proses bayar tagihan, Cuy.");
    }
}

// ==========================================
// HELPER: Bayar Cicilan (DENGAN KONFIRMASI)
// ==========================================
async function handleBayarCicilan(ctx: any, namaCicilan: string) {
    try {
        const { data: installments, error } = await supabase
            .from('installments')
            .select('*')
            .ilike('name', `%${namaCicilan}%`);

        if (error) throw error;

        const aktif = installments?.filter(i => Number(i.tenor_months) > Number(i.paid_months)) || [];

        if (!installments || installments.length === 0) {
            return await handleListCicilan(ctx);
        }

        if (aktif.length === 0) {
            return ctx.reply(`✅ Semua cicilan yang mengandung *"${namaCicilan}"* udah lunas, Cuy! 🎉`);
        }

        if (aktif.length > 1) {
            let listText = `🤔 Ada beberapa cicilan yang mirip nih:\n\n`;
            aktif.forEach((i, idx) => {
                const sisa = Number(i.tenor_months) - Number(i.paid_months);
                listText += `${idx + 1}. *${i.name}* — ${formatIDR(Number(i.monthly_amount))}/bulan (Sisa ${sisa} bulan)\n`;
            });
            listText += `\nKetik lebih spesifik ya, Cuy!\nContoh: \`cicil motor beat\` atau \`cicil rumah kpr\``;
            return await ctx.replyWithMarkdown(listText);
        }

        const installment = aktif[0];
        const amount = Number(installment.monthly_amount);
        const actor = ctx.state.actor;
        const encodedName = encodeURIComponent(installment.name);

        await ctx.reply(
            `🏠 **Konfirmasi Bayar Cicilan**\n\n` +
            `📝 *${installment.name}*\n` +
            `💰 Nominal Bulanan: *${formatIDR(amount)}*\n` +
            `📊 Progress: ${installment.paid_months}/${installment.tenor_months} bulan\n` +
            `👤 Eksekutor: ${actor === 'suami' ? '🧑 Qisthi' : '👩 Gita'}\n\n` +
            `Mau potong dari kantong mana nih?`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌐 Kantong Bersama', callback_data: `payinstall:${amount}:${actor}:operasional_utama:${encodedName}:${installment.id}` }],
                        [{ text: '🧑 Jajan Qisthi', callback_data: `payinstall:${amount}:${actor}:jajan_qisthi:${encodedName}:${installment.id}` }],
                        [{ text: '👩 Jajan Gita', callback_data: `payinstall:${amount}:${actor}:jajan_gita:${encodedName}:${installment.id}` }],
                        [{ text: '❌ Batal', callback_data: `cancel_install` }]
                    ]
                }
            }
        );

    } catch (err) {
        console.error("❌ Gagal bayar cicilan:", err);
        await ctx.reply("⚠️ Error pas proses bayar cicilan, Cuy.");
    }
}

// ==========================================
// HELPER: Generate Laporan CSV
// ==========================================
async function handleLaporan(ctx: any) {
    try {
        await ctx.reply("📊 Sedang merekap data transaksi dan merakit file Excel...");

        const sekarang = new Date();
        const awalBulan = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1).toISOString();
        const akhirBulan = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const { data: txData, error } = await supabase
            .from('transactions')
            .select(`created_at, description, amount, type, actor, pockets(name)`)
            .gte('created_at', awalBulan)
            .lte('created_at', akhirBulan)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!txData || txData.length === 0) {
            return await ctx.reply("ℹ️ Belum ada histori transaksi untuk bulan ini, Cuy.");
        }

        let csvContent = "Tanggal;Deskripsi;Nominal;Tipe;Kantong Pos;Eksekutor\n";
        txData.forEach(tx => {
            const tgl = new Date(tx.created_at).toLocaleDateString('id-ID');
            const deskripsi = tx.description.replace(/;/g, ',');
            const nominal = tx.amount;
            const tipe = tx.type === 'expense' ? 'Pengeluaran' : tx.type === 'income' ? 'Pemasukan' : 'Transfer';
            // @ts-ignore
            const namaKantong = tx.pockets?.name ? tx.pockets.name.replace(/_/g, ' ') : 'Umum';
            const pelaku = tx.actor === 'suami' ? 'Qisthi' : tx.actor === 'istri' ? 'Gita' : 'Sistem';
            csvContent += `${tgl};${deskripsi};${nominal};${tipe};${namaKantong};${pelaku}\n`;
        });

        const namaFile = `Laporan_Keuangan_${sekarang.toLocaleString('id-ID', { month: 'long' })}_${sekarang.getFullYear()}.csv`;
        const streamFile = Readable.from([csvContent]);

        await ctx.replyWithDocument({
            source: streamFile,
            filename: namaFile
        }, {
            caption: `📊 **Laporan Keuangan Selesai Dibuat!**\n\nFile CSV siap dibuka di Excel. 🚀`
        });

    } catch (err) {
        console.error("❌ Gagal membuat laporan:", err);
        await ctx.reply("⚠️ Error pas generate laporan, Cuy.");
    }
}

// ==========================================
// HELPER: Parser Transaksi Manual (Fallback)
// ==========================================
function parseTransactionManual(text: string): { amount: number; description: string; type: string; allocated_pocket: string; actor: string } | null {
    const pesan = text.toLowerCase().trim();

    // Regex: cari nominal uang
    const nominalMatch = pesan.match(/(\d+[.,]?\d*)\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i);
    if (!nominalMatch) return null;

    let amount = Number(nominalMatch[1].replace(',', '.'));
    const unit = nominalMatch[2]?.toLowerCase();

    if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount *= 1000;
    else if (unit === 'jt' || unit === 'juta') amount *= 1000000;
    else if (unit === 'milyar' || unit === 'miliar' || unit === 'm') amount *= 1000000000;

    if (amount <= 0 || amount > 100000000000) return null;

    // Deteksi tipe
    let type = 'expense';
    if (/gaji|masuk|income|bonus|dapet|terima|transfer masuk/i.test(pesan)) {
        type = 'income';
    } else if (/transfer|pindah/i.test(pesan)) {
        type = 'transfer';
    }

    // Deteksi aktor
    let actor = 'auto';
    if (/gita|istri|bunda|mama|istri saya/i.test(pesan)) {
        actor = 'istri';
    } else if (/\bsaya\b|\baku\b|qisthi|ayah|papa|suami/i.test(pesan)) {
        actor = 'suami';
    }

    // Deteksi kantong
    let allocated_pocket = 'ASK_USER';
    if (/jajan qisthi|jajan ku|jajan saya|jajan pribadi qisthi/i.test(pesan)) allocated_pocket = 'jajan_qisthi';
    else if (/jajan gita|jajan istri|jajan pribadi gita/i.test(pesan)) allocated_pocket = 'jajan_gita';
    else if (/operasional/i.test(pesan)) allocated_pocket = 'operasional_utama';
    else if (/transportasi|bensin|motor|servis|parkir|spbu/i.test(pesan)) allocated_pocket = 'transportasi_dan_kendaraan';
    else if (/bayi|popok|susu|anak|babyshop/i.test(pesan)) allocated_pocket = 'keperluan_bayi';
    else if (/wifi|listrik|tagihan|pln|pdam|pulsa/i.test(pesan)) allocated_pocket = 'kebutuhan_rutin_bulanan';
    else if (/tabungan|investasi|emas|reksadana|saham/i.test(pesan)) allocated_pocket = 'tabungan_masa_depan';
    else if (/jajan|makan|kopi|cemilan|bakso|seblak|mie|ayam|es|minum/i.test(pesan)) allocated_pocket = 'operasional_harian';

    // Deskripsi
    const cleanDesc = text
        .replace(/rp\.?\s*/gi, '')
        .replace(/\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/gi, '')
        .replace(/pake\s+.*/gi, '')
        .replace(/dari\s+.*/gi, '')
        .replace(/masuk\s+ke\s+.*/gi, '')
        .trim();

    const description = cleanDesc || text.replace(/\d.*/, '').trim() || 'Transaksi';

    return {
        amount: Math.round(amount),
        description: description.replace(/^[.,\s]+/, '').trim() || 'Transaksi',
        type,
        allocated_pocket,
        actor
    };
}

// ==========================================
// HANDLER TEKS (DENGAN PRIORITAS KEYWORD)
// ==========================================
bot.on('text', async (ctx) => {
    const pesanAsli = ctx.message.text;
    const pesan = pesanAsli.toLowerCase().trim();

    // 1. SKIP COMMAND
    if (pesan.startsWith('/')) return;

    // 2. KEYWORD BAYAR CICILAN (HARUS DI ATAS BAYAR TAGIHAN!)
    if (pesan === 'cicil' || pesan === 'cicilan' || pesan === 'bayar cicilan') {
        return await handleListCicilan(ctx);
    }

    if (pesan.startsWith('cicil ') || pesan.startsWith('bayar cicilan ')) {
        const namaCicilan = pesan.replace(/^(cicil|bayar cicilan)\s+/, '').trim();
        console.log(`🔍 Bayar cicilan: "${namaCicilan}"`);
        return await handleBayarCicilan(ctx, namaCicilan);
    }

    // 3. KEYWORD BAYAR TAGIHAN
    if (pesan === 'bayar' || pesan === 'bayarin' || pesan === 'bayar tagihan' || pesan === 'tagihan') {
        return await handleListTagihan(ctx);
    }

    if (pesan.startsWith('bayar ') || pesan.startsWith('bayarin ')) {
        const namaTagihan = pesan.replace(/^bayar(in)?\s+/, '').trim();
        if (namaTagihan === 'cicilan') {
            return await handleListCicilan(ctx);
        }
        console.log(`🔍 Bayar tagihan: "${namaTagihan}"`);
        return await handleBayarTagihan(ctx, namaTagihan);
    }

    // 4. KEYWORD SALDO
    const saldoKeywords = ['cek saldo', 'saldo', 'lihat saldo', 'saldo gw', 'sisa saldo', 'sisa uang', 'cek duit'];
    if (saldoKeywords.some(k => pesan.includes(k))) {
        console.log(`🔍 Saldo: "${pesanAsli}"`);
        await ctx.reply("🔍 Menghitung saldo...");
        return await handleCekSaldo(ctx);
    }

    // 5. KEYWORD RINGKASAN
    const ringkasanKeywords = ['ringkasan', 'rekap', 'rangkuman', 'summary', 'overview', 'ikhtisar', 'bulan ini'];
    if (ringkasanKeywords.some(k => pesan.includes(k))) {
        console.log(`🔍 Ringkasan: "${pesanAsli}"`);
        return await handleRingkasan(ctx);
    }

    // 6. KEYWORD LAPORAN (CSV)
    const laporanKeywords = ['laporan keuangan', 'laporan pengeluaran', 'laporan pemasukan', 'download laporan', 'export', 'riwayat transaksi', 'history', 'mutasi'];
    if (laporanKeywords.some(k => pesan.includes(k))) {
        console.log(`🔍 Laporan: "${pesanAsli}"`);
        return await handleLaporan(ctx);
    }

    // 7. KEYWORD HELP
    const helpKeywords = ['help', 'bantuan', 'fitur', 'bisa apa', 'perintah', 'command', 'apa aja'];
    if (helpKeywords.some(k => pesan.includes(k))) {
        return await ctx.reply(
            `🤖 *Moni - Asisten Keuangan Keluarga*\n\n` +
            `📝 *Fitur yang tersedia:*\n\n` +
            `💰 *Cek Saldo*\nKetik "/saldo" atau "cek saldo"\n\n` +
            `📊 *Ringkasan Bulanan*\nKetik "/ringkasan" atau "ringkasan"\n\n` +
            `🧾 *Bayar Tagihan*\nKetik "/bayar wifi" atau "bayar listrik"\n\n` +
            `🏠 *Bayar Cicilan*\nKetik "/cicil motor" atau "bayar cicilan rumah"\n\n` +
            `📁 *Download Laporan CSV*\nKetik "/laporan" atau "export"\n\n` +
            `📝 *Catat Transaksi*\n"Beli kopi 35rb pake jajan qisthi"\n\n` +
            `📸 *Struk Belanja*\nKirim foto struk/nota\n\n` +
            `💬 *Ngobrol Santai*\n"Hai Moni!" atau curhat apa aja\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🤖 *Moni siap bantu 24/7!* 🚀`,
            { parse_mode: 'Markdown' }
        );
    }

    // 8. KEYWORD SAPAAN
    const sapaanKeywords = ['hai', 'halo', 'hello', 'hi', 'woi', 'eh', 'p', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'test', 'tes', 'oy', 'oi', 'hallo', 'hewwo', 'hy', 'yo', 'wow', 'halo moni', 'hai moni', 'p moni'];
    const isSapaanOnly = sapaanKeywords.some(k => pesan === k || pesan.startsWith(k + ' ') || pesan.endsWith(' ' + k));

    if (isSapaanOnly) {
        const actorEmoji = ctx.state.actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
        const sapaanList = [
            `Halo ${actorEmoji}! 👋 Ada yang bisa Moni bantu?`,
            `Hei ${actorEmoji}! 😊 Lagi ngapain nih? Mau catat transaksi?`,
            `Hai hai! 🥳 Moni siap bantu keuangan kamu! Mau cek saldo?`,
            `Yuhuu ${actorEmoji}! 🙌 Mau cek saldo, bayar tagihan, atau catat transaksi?`,
            `Halo Cuy! 👋 Moni ready 24/7 buat bantu keuangan!`,
            `Eh ada ${actorEmoji}! 😎 Tumben nyapa, mau transaksi apa nih?`,
            `Waduh ${actorEmoji}, tak kira siapa! 😆 Ada yang bisa dibantuin?`,
            `Assalamualaikum ${actorEmoji}! 🌙 Moni siap bantu keuangan!`,
            `Oy oy oy! ${actorEmoji} muncul juga! 🔥 Mau ngapain nih?`,
            `Halo halo Bandung! 📞 Ada ${actorEmoji}, mau laporan keuangan?`,
            `Woi ${actorEmoji}! 🫡 Siap laksanakan tugas! Mau apa nih?`,
            `Yeay ${actorEmoji} dateng! 🎉 Moni kangen! Mau cek saldo kah?`,
            `Hai ${actorEmoji}, hari ini cerah ya! ☀️ Ada transaksi yang mau dicatat?`,
            `Cuy! ${actorEmoji} is in the house! 🏠 Moni siap 24 jam!`,
        ];
        return await ctx.reply(sapaanList[Math.floor(Math.random() * sapaanList.length)]);
    }

    // 9. KEYWORD PERTANYAAN UMUM
    const tanyaKeywords = ['apa kabar', 'gimana', 'bagaimana', 'lagi apa', 'kamu siapa', 'lagi ngapain', 'sehat', 'baik'];
    if (tanyaKeywords.some(k => pesan.includes(k))) {
        const jawabanList = [
            `Moni sehat selalu, Cuy! 💪 Lagi siap bantu keuangan kamu nih. Ada yang perlu dicatat?`,
            `Baik banget! 😊 Moni selalu ready buat bantu catat transaksi atau cek saldo.`,
            `Alhamdulillah sehat! 🙏 Moni di sini 24/7 buat bantu keuangan keluarga.`,
        ];
        return await ctx.reply(jawabanList[Math.floor(Math.random() * jawabanList.length)]);
    }

    // 10. DETEKSI TRANSAKSI
    const punyaNominal = /\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i.test(pesan);
    const transaksiKeywords = /beli|bayar|jajan|makan|minum|belanja|transfer|masuk|gaji|bonus|topup|isi|pulsa|servis|bensin|parkir|tagihan|cicil/i.test(pesan);
    const isKemungkinanTransaksi = punyaNominal || transaksiKeywords;

    // 11. PROSES TRANSAKSI (GROQ/GEMINI -> FALLBACK MANUAL)
    if (isKemungkinanTransaksi) {
        await ctx.reply("⏳ Sebentar ya, Moni catat transaksinya...");

        let hasilParse = null;
        let aiAvailable = true;

        // Coba AI service (Groq atau Gemini)
        try {
            hasilParse = await parseFinancialText(pesanAsli);
            if (!hasilParse) {
                console.log('⚠️ AI return null, fallback ke manual...');
            }
        } catch (aiError: any) {
            console.log('⚠️ AI error, fallback ke parser manual...');
            if (aiError?.status === 429) {
                aiAvailable = false;
                await ctx.reply('⚠️ *Notif:* AI lagi limit, Moni pake parser manual dulu ya.', { parse_mode: 'Markdown' });
            }
        }

        // Fallback ke parser manual
        if (!hasilParse) {
            const manualResult = parseTransactionManual(pesanAsli);
            if (manualResult) {
                hasilParse = manualResult as any;
                console.log('✅ Parser manual berhasil!');
            }
        }

        if (hasilParse) {
            const { amount, description, type, allocated_pocket, actor: aiActor } = hasilParse;
            const finalActor = aiActor === 'auto' ? ctx.state.actor : aiActor;

            if (allocated_pocket === 'ASK_USER') {
                const formattedAmount = formatIDR(amount);
                const encodedDesc = encodeURIComponent(description);
                await ctx.reply(
                    `🤔 **Moni Ragu-Ragu...**\n\n` +
                    `Transaksi *"${description}"* sebesar *${formattedAmount}* mau dipotong dari kantong mana nih?`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🌐 Kantong Bersama', callback_data: `p_idx:${amount}:${finalActor}:operasional_utama:${encodedDesc}` }],
                                [
                                    { text: '🧑 Jajan Qisthi', callback_data: `p_idx:${amount}:${finalActor}:jajan_qisthi:${encodedDesc}` },
                                    { text: '👩 Jajan Gita', callback_data: `p_idx:${amount}:${finalActor}:jajan_gita:${encodedDesc}` }
                                ],
                                [{ text: '🚗 Transportasi', callback_data: `p_idx:${amount}:${finalActor}:transportasi_dan_kendaraan:${encodedDesc}` }],
                                [{ text: '👶 Keperluan Bayi', callback_data: `p_idx:${amount}:${finalActor}:keperluan_bayi:${encodedDesc}` }]
                            ]
                        }
                    }
                );
                return;
            }

            try {
                const { data: pocketData } = await supabase.from('pockets').select('id').eq('name', allocated_pocket).single();
                const finalPocketId = pocketData ? pocketData.id : 1;

                const { error: dbError } = await supabase.from('transactions').insert([{
                    amount, description, type, pocket_id: finalPocketId, asset_id: 1, actor: finalActor
                }]);
                if (dbError) throw dbError;

                const { data: currentPocket } = await supabase.from('pockets').select('current_balance').eq('id', finalPocketId).single();
                if (currentPocket) {
                    const modifier = type === 'expense' ? -1 : 1;
                    const newBalance = Number(currentPocket.current_balance) + (amount * modifier);
                    await supabase.from('pockets').update({ current_balance: newBalance }).eq('id', finalPocketId);
                }

                const actorEmoji = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
                const aiStatus = getAIStatus();
                await ctx.replyWithMarkdown(`
✅ **Data Berhasil Masuk Database!**
━━━━━━━━━━━━━━━━━━━
📝 **Deskripsi:** ${description}
💰 **Nominal:** ${formatIDR(amount)}
🔄 **Jenis:** ${type === 'expense' ? '🔴 Pengeluaran' : type === 'income' ? '🟢 Pemasukan' : '🔵 Transfer'}
📂 **Alokasi Pos:** \`${allocated_pocket}\`
👤 **Eksekutor:** ${actorEmoji}
🧠 **AI:** ${aiStatus}
━━━━━━━━━━━━━━━━━━━
🤖 *Moni telah mengamankan transaksi kamu.*
`);
                // Kirim notif email
                sendTransactionEmailNotification({
                    actor: finalActor,
                    amount, description, type,
                    pocketName: allocated_pocket
                }).catch(err => console.error('❌ Gagal kirim notif email:', err));
            } catch (dbError) {
                console.error("❌ DB Error:", dbError);
                await ctx.reply("⚠️ Data berhasil dibaca, tapi gagal disimpan ke database, Cuy.");
            }
        } else {
            await ctx.reply(
                "🤔 *Moni bingung nih...*\n\n" +
                "Gw gak bisa nangkep nominal dari pesan lu.\n" +
                "Coba format: \"Beli kopi 35rb pake jajan qisthi\"\n\n" +
                "💡 Butuh bantuan? Ketik \"help\"",
                { parse_mode: 'Markdown' }
            );
        }
        return;
    }

    // 12. DEFAULT REPLY
    const randomReplies = [
        `Hmm Moni kurang paham nih. 🤔 Mau transaksi? Format: "Beli kopi 35rb pake jajan qisthi"`,
        `Gimana nih Cuy? Mau catat transaksi, cek saldo, atau bayar tagihan? Ketik "help" buat liat fitur.`,
        `Moni siap bantu! 💪 Tapi Moni gak ngerti maksudnya. Coba ketik "help" ya.`,
    ];
    return await ctx.reply(randomReplies[Math.floor(Math.random() * randomReplies.length)]);
});

// ==========================================
// CALLBACK QUERY (TOMBOL KANTONG + BAYAR TAGIHAN + BAYAR CICILAN)
// ==========================================
bot.on('callback_query', async (ctx) => {
    // @ts-ignore
    const callbackData = ctx.callbackQuery.data;
    if (!callbackData) return;

    if (callbackData.startsWith('p_idx:')) {
        await ctx.answerCbQuery("⏳ Memproses...");
        const parts = callbackData.split(':');
        const amount = Number(parts[1]);
        const actor = parts[2];
        const selectedPocket = parts[3];
        const encodedDesc = parts.slice(4).join(':');
        const description = decodeURIComponent(encodedDesc);

        try {
            const { data: pocketData } = await supabase.from('pockets').select('id').eq('name', selectedPocket).single();
            const finalPocketId = pocketData ? pocketData.id : 1;
            const { error: dbError } = await supabase.from('transactions').insert([{
                amount, description, type: 'expense', pocket_id: finalPocketId, asset_id: 1, actor
            }]);
            if (dbError) throw dbError;

            const { data: currentPocket } = await supabase.from('pockets').select('current_balance').eq('id', finalPocketId).single();
            if (currentPocket) {
                await supabase.from('pockets').update({ current_balance: Number(currentPocket.current_balance) - amount }).eq('id', finalPocketId);
            }

            const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            await ctx.editMessageText(
                `✅ **Tersimpan!**\n━━━━━━━━━━━━━━━━━━━\n📝 ${description}\n💰 ${formatIDR(amount)}\n📂 \`${selectedPocket}\`\n👤 ${actorEmoji}`,
                { parse_mode: 'Markdown' }
            );
            sendTransactionEmailNotification({ actor, amount, description, type: 'expense', pocketName: selectedPocket })
                .catch(err => console.error('❌ Gagal kirim notif email:', err));
        } catch (error) {
            console.error("❌ Callback error:", error);
            await ctx.editMessageText("❌ Gagal menyimpan, coba lagi.").catch(() => { });
        }
    }
    else if (callbackData.startsWith('paybill:')) {
        await ctx.answerCbQuery("⏳ Memproses pembayaran tagihan...");
        const parts = callbackData.split(':');
        const amount = Number(parts[1]);
        const actor = parts[2];
        const selectedPocket = parts[3];
        const encodedName = parts[4];
        const billId = parts[5];
        const billName = decodeURIComponent(encodedName);

        try {
            await supabase.from('bills').update({ status: 'paid', last_paid_at: new Date().toISOString() }).eq('id', billId);
            const { data: pocketData } = await supabase.from('pockets').select('id').eq('name', selectedPocket).single();
            const finalPocketId = pocketData ? pocketData.id : 1;
            await supabase.from('transactions').insert([{
                amount, description: `Bayar tagihan: ${billName}`, type: 'expense', pocket_id: finalPocketId, asset_id: 1, actor
            }]);
            const { data: currentPocket } = await supabase.from('pockets').select('current_balance').eq('id', finalPocketId).single();
            if (currentPocket) {
                await supabase.from('pockets').update({ current_balance: Number(currentPocket.current_balance) - amount }).eq('id', finalPocketId);
            }

            const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            await ctx.editMessageText(
                `✅ **Tagihan Lunas!**\n━━━━━━━━━━━━━━━━━━━\n📝 ${billName}\n💰 ${formatIDR(amount)}\n📂 \`${selectedPocket}\`\n👤 ${actorEmoji}\n\n🎉 Tagihan berhasil dibayar!`,
                { parse_mode: 'Markdown' }
            );
            sendTransactionEmailNotification({ actor, amount, description: `Bayar tagihan: ${billName}`, type: 'expense', pocketName: selectedPocket })
                .catch(err => console.error('❌ Gagal kirim notif email:', err));
        } catch (error) {
            console.error("❌ Paybill error:", error);
            await ctx.editMessageText("❌ Gagal bayar tagihan.").catch(() => { });
        }
    }
    else if (callbackData.startsWith('payinstall:')) {
        await ctx.answerCbQuery("⏳ Memproses pembayaran cicilan...");
        const parts = callbackData.split(':');
        const amount = Number(parts[1]);
        const actor = parts[2];
        const selectedPocket = parts[3];
        const encodedName = parts[4];
        const installmentId = parts[5];
        const installmentName = decodeURIComponent(encodedName);

        try {
            const { data: installment } = await supabase.from('installments').select('paid_months').eq('id', installmentId).single();
            if (!installment) {
                await ctx.answerCbQuery("❌ Data cicilan tidak ditemukan.");
                return;
            }
            const newPaidMonths = Number(installment.paid_months) + 1;
            await supabase.from('installments').update({ paid_months: newPaidMonths }).eq('id', installmentId);
            const { data: pocketData } = await supabase.from('pockets').select('id').eq('name', selectedPocket).single();
            const finalPocketId = pocketData ? pocketData.id : 1;
            await supabase.from('transactions').insert([{
                amount, description: `Bayar cicilan: ${installmentName} (Bulan ke-${newPaidMonths})`, type: 'expense', pocket_id: finalPocketId, asset_id: 1, actor
            }]);
            const { data: currentPocket } = await supabase.from('pockets').select('current_balance').eq('id', finalPocketId).single();
            if (currentPocket) {
                await supabase.from('pockets').update({ current_balance: Number(currentPocket.current_balance) - amount }).eq('id', finalPocketId);
            }

            const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            await ctx.editMessageText(
                `✅ **Cicilan Dibayar!**\n━━━━━━━━━━━━━━━━━━━\n📝 ${installmentName}\n💰 ${formatIDR(amount)}\n📊 Bulan ke: ${newPaidMonths}\n📂 \`${selectedPocket}\`\n👤 ${actorEmoji}\n\n🏠 Satu bulan lagi terbayar!`,
                { parse_mode: 'Markdown' }
            );
            sendTransactionEmailNotification({ actor, amount, description: `Bayar cicilan: ${installmentName} (Bulan ke-${newPaidMonths})`, type: 'expense', pocketName: selectedPocket })
                .catch(err => console.error('❌ Gagal kirim notif email:', err));
        } catch (error) {
            console.error("❌ Payinstall error:", error);
            await ctx.editMessageText("❌ Gagal bayar cicilan.").catch(() => { });
        }
    }
    else if (callbackData === 'cancel_bill' || callbackData === 'cancel_install') {
        await ctx.answerCbQuery("Dibatalkan.");
        await ctx.editMessageText("❌ Pembayaran dibatalkan.").catch(() => { });
    }
});

// ==========================================
// HANDLER FOTO STRUK
// ==========================================
bot.on('photo', async (ctx) => {
    try {
        await ctx.reply("📸 Moni lagi baca struknya...");
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
        const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer', timeout: 10000 });
        const imageBuffer = Buffer.from(response.data);
        const hasilParse = await parseFinancialImage(imageBuffer, 'image/jpeg');

        if (hasilParse) {
            const { amount, description, type, allocated_pocket } = hasilParse;
            const finalActor = ctx.state.actor;

            if (allocated_pocket === 'ASK_USER') {
                const encodedDesc = encodeURIComponent(description);
                await ctx.reply(
                    `🤔 **Moni ragu...**\n*"${description}"* sebesar *${formatIDR(amount)}* masuk kantong mana?`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🌐 Kantong Bersama', callback_data: `p_idx:${amount}:${finalActor}:operasional_utama:${encodedDesc}` }],
                                [
                                    { text: '🧑 Jajan Qisthi', callback_data: `p_idx:${amount}:${finalActor}:jajan_qisthi:${encodedDesc}` },
                                    { text: '👩 Jajan Gita', callback_data: `p_idx:${amount}:${finalActor}:jajan_gita:${encodedDesc}` }
                                ]
                            ]
                        }
                    }
                );
                return;
            }

            const { data: pocketData } = await supabase.from('pockets').select('id').eq('name', allocated_pocket).single();
            const finalPocketId = pocketData ? pocketData.id : 1;
            await supabase.from('transactions').insert([{ amount, description, type, pocket_id: finalPocketId, asset_id: 1, actor: finalActor }]);
            const { data: currentPocket } = await supabase.from('pockets').select('current_balance').eq('id', finalPocketId).single();
            if (currentPocket) {
                await supabase.from('pockets').update({ current_balance: Number(currentPocket.current_balance) - amount }).eq('id', finalPocketId);
            }

            const actorEmoji = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            await ctx.replyWithMarkdown(`
✅ **Struk Tercatat!**
━━━━━━━━━━━━━━━━━━━
📝 ${description}
💰 ${formatIDR(amount)}
📂 \`${allocated_pocket}\`
👤 ${actorEmoji}
🤖 *Moni amankan.*
            `);
            sendTransactionEmailNotification({ actor: finalActor, amount, description, type, pocketName: allocated_pocket })
                .catch(err => console.error('❌ Gagal kirim notif email:', err));
        } else {
            await ctx.reply("❌ Gagal baca struk, Cuy.");
        }
    } catch (error) {
        console.error("❌ Error foto:", error);
        await ctx.reply("❌ Gangguan teknis pas baca struk.");
    }
});

// ==========================================
// COMMANDS
// ==========================================
bot.command('saldo', async (ctx) => { await ctx.reply("🔍 Menghitung saldo..."); return await handleCekSaldo(ctx); });
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
        `🤖 *Moni - Asisten Keuangan Keluarga*\n\n` +
        `📝 *Fitur yang tersedia:*\n\n` +
        `💰 *Cek Saldo*\nKetik "/saldo" atau "cek saldo"\n\n` +
        `📊 *Ringkasan Bulanan*\nKetik "/ringkasan" atau "ringkasan"\n\n` +
        `🧾 *Bayar Tagihan*\nKetik "/bayar wifi" atau "bayar listrik"\n\n` +
        `🏠 *Bayar Cicilan*\nKetik "/cicil motor" atau "bayar cicilan rumah"\n\n` +
        `📁 *Download Laporan CSV*\nKetik "/laporan" atau "export"\n\n` +
        `📝 *Catat Transaksi*\n"Beli kopi 35rb pake jajan qisthi"\n\n` +
        `📸 *Struk Belanja*\nKirim foto struk/nota\n\n` +
        `💬 *Ngobrol Santai*\n"Hai Moni!" atau curhat apa aja\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🤖 *Moni siap bantu 24/7!* 🚀`,
        { parse_mode: 'Markdown' }
    );
});

// ==========================================
// START BOT & CRON
// ==========================================
console.log('🤖 Menghubungkan ke Bot Telegram...');
bot.launch()
    .then(() => {
        console.log('✅ Bot Telegram aktif!');
        setBotInstance(bot);
        startCronJobs();
    })
    .catch((err) => console.error('❌ Gagal:', err));

app.get('/', (req, res) => res.send('Backend Running! 🚀'));
app.listen(PORT, () => console.log(`Server di http://localhost:${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));