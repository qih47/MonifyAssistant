import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import { parseFinancialText, parseFinancialImage, getAIStatus } from './services/aiService.js';
import { supabase } from './config/supabaseClient.js';
import { Readable } from 'stream';
import { sendTransactionEmailNotification } from './services/notificationService.js';
import { setBotInstance, startCronJobs, checkDueBills, checkDueInstallments } from './services/cronService.js';


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

// ==========================================
// TEMPORARY STORAGE (SUNTIK DATA GRANULAR & GOALS)
// ==========================================
const pendingTransactions = new Map<string, {
    amount: number;
    actor: string;
    description: string;
    type: string;
    timestamp: number;
    category?: string;          // FITUR 1 & 2
    merchant?: string;          // FITUR 1
    transaction_date?: string;  // FITUR 1
    is_saving_goal?: boolean;   // FITUR 3 & 4
    goal_name?: string | null;  // FITUR 3 & 4
}>();

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of pendingTransactions) {
        if (now - value.timestamp > 10 * 60 * 1000) {
            pendingTransactions.delete(key);
        }
    }
}, 60 * 1000);

// ==========================================
// MIDDLEWARE
// ==========================================
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

    if ((ctx.updateType === 'message' && ctx.message) || ctx.updateType === 'callback_query') {
        return next();
    }

    console.log(`ℹ️ Update tipe [${ctx.updateType}] diabaikan.`);
    return;
});

// ==========================================
// COMMAND /start
// ==========================================
bot.start((ctx) => {
    const actorEmoji = ctx.state.actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
    ctx.reply(
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🤖 *Moni - Asisten Keuangan*\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Halo ${actorEmoji}! 👋\n\n` +
        `📝 *Fitur Utama:*\n` +
        `• *Catat transaksi:* "Beli kopi 35rb"\n` +
        `• *Cek saldo:* /saldo atau "saldo"\n` +
        `• *Ringkasan:* /ringkasan atau "rekap"\n` +
        `• *Laporan CSV:* /laporan atau "export"\n` +
        `• *Bayar tagihan:* /bayar [nama]\n` +
        `• *Bayar cicilan:* /cicil [nama]\n` +
        `• *Foto struk:* Kirim foto langsung\n\n` +
        `Aktor: *${ctx.state.actor === 'suami' ? '🧑 Qisthi' : '👩 Gita'}*`,
        { parse_mode: 'Markdown' }
    );
});

// ==========================================
// HELPER: Format Rupiah
// ==========================================
const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

// ==========================================
// HELPER: Format Nama Pocket (snake_case -> Title Case)
// ==========================================
function formatPocketName(name: string): string {
    return name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

// ==========================================
// HELPER: Get Pocket Icon
// ==========================================
function getPocketIcon(ownership: string, pocketName?: string): string {
    const ownerIconMap: Record<string, string> = {
        'bersama': '💳',
        'suami': '🧑',
        'istri': '👩',
    };

    const nameIconMap: Record<string, string> = {
        'operasional_utama': '🏦',
        'operasional_harian': '🛒',
        'jajan_qisthi': '🍜',
        'jajan_gita': '🧋',
        'transportasi_dan_kendaraan': '🏍️',
        'keperluan_bayi': '👶',
        'kebutuhan_rutin_bulanan': '📋',
        'tabungan_masa_depan': '💰',
    };

    if (pocketName && nameIconMap[pocketName]) {
        return nameIconMap[pocketName];
    }

    return ownerIconMap[ownership] || '💵';
}

// ==========================================
// HELPER: Natural Response Generator
// ==========================================
async function generateNaturalResponse(context: string, userName: string): Promise<string> {
    try {
        const OpenAI = (await import('openai')).default;
        const groqClient = new OpenAI({
            apiKey: process.env.GROQ_API_KEY || '',
            baseURL: 'https://api.groq.com/openai/v1',
        });

        const response = await groqClient.chat.completions.create({
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            temperature: 0.5,
            messages: [
                {
                    role: 'system',
                    content: `Kamu adalah Moni, asisten keuangan keluarga yang profesional, informatif, and friendly. Panggil user "${userName}" atau "Kak". Bahasa Indonesia yang baik, jelas, dan to the point. JANGAN gunakan kata "gue", "lo", "cuy". Singkat 1-2 kalimat.`
                },
                { role: 'user', content: context }
            ],
            max_tokens: 60,
        });
        return response.choices[0]?.message?.content || 'Siap, Kak! 🚀';
    } catch {
        return 'Siap, Kak! 🚀';
    }
}

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
            return ctx.reply("✅ Tidak ada tagihan pending, Kak! Keuangan aman terkendali.");
        }

        let totalTagihan = 0;
        let listText = "━━━━━━━━━━━━━━━━━━━\n📋 *DAFTAR TAGIHAN BELUM DIBAYAR*\n━━━━━━━━━━━━━━━━━━━\n\n";
        bills.forEach((b, i) => {
            totalTagihan += Number(b.amount);
            const dueDate = b.due_date
                ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })
                : 'Tgl tidak diketahui';
            listText += `${i + 1}. *${b.name}*\n   💰 ${formatIDR(Number(b.amount))} | 📅 Jatuh tempo: ${dueDate}\n\n`;
        });
        listText += `━━━━━━━━━━━━━━━━━━━\n⚠️ *Total Tagihan: ${formatIDR(totalTagihan)}*\n\n`;
        listText += `Ketik \`bayar [nama tagihan]\` untuk melunasi.`;

        await ctx.replyWithMarkdown(listText);
    } catch (err) {
        console.error("❌ Gagal list tagihan:", err);
        await ctx.reply("⚠️ Gagal mengambil data tagihan, Kak.");
    }
}

// ==========================================
// HELPER: List Cicilan Aktif
// ==========================================
async function handleListCicilan(ctx: any) {
    try {
        const { data: installments, error } = await supabase
            .from('installments')
            .select('name, monthly_amount, paid_months, tenor_months, total_amount, down_payment')
            .order('name', { ascending: true });

        if (error) throw error;

        if (!installments || installments.length === 0) {
            return ctx.reply("✅ Tidak ada cicilan aktif, Kak! Keuangan aman terkendali.");
        }

        let listText = "━━━━━━━━━━━━━━━━━━━\n🏠 *DAFTAR CICILAN AKTIF*\n━━━━━━━━━━━━━━━━━━━\n\n";
        let adaCicilan = false;
        let totalCicilanBulanan = 0;

        installments.forEach((i, idx) => {
            const sisaBulan = Number(i.tenor_months) - Number(i.paid_months);
            if (sisaBulan > 0) {
                adaCicilan = true;
                totalCicilanBulanan += Number(i.monthly_amount);
                const totalDibayar = Number(i.down_payment || 0) + (Number(i.paid_months) * Number(i.monthly_amount));
                const sisaTotal = Number(i.total_amount) - totalDibayar;
                const progressPct = Math.round((Number(i.paid_months) / Number(i.tenor_months)) * 100);

                listText += `${idx + 1}. *${i.name}*\n`;
                listText += `   💰 ${formatIDR(Number(i.monthly_amount))}/bulan\n`;
                listText += `   📊 Progress: ${i.paid_months}/${i.tenor_months} bulan (${progressPct}%)\n`;
                listText += `   💵 Sisa total: ${formatIDR(sisaTotal)}\n\n`;
            }
        });

        if (!adaCicilan) {
            return ctx.reply("🎉 Semua cicilan sudah lunas, Kak! Tidak ada yang perlu dibayar.");
        }

        listText += `━━━━━━━━━━━━━━━━━━━\n⚠️ *Total Cicilan/Bulan: ${formatIDR(totalCicilanBulanan)}*\n\n`;
        listText += `Ketik \`cicil [nama cicilan]\` untuk membayar.`;

        await ctx.replyWithMarkdown(listText);
    } catch (err) {
        console.error("❌ Gagal list cicilan:", err);
        await ctx.reply("⚠️ Gagal mengambil data cicilan, Kak.");
    }
}

// ==========================================
// HELPER: Check & Notify Low Fund (NEW FEATURE!)
// ==========================================
async function checkAndNotifyLowFund(ctx: any, pocketName: string, newBalance: number, actor: string): Promise<void> {
    try {
        // 🚨 THRESHOLD CONFIGURATION
        const LOW_FUND_THRESHOLD = 2000000; // 2 juta = warning threshold
        const CRITICAL_THRESHOLD = 1000000; // 1 juta = critical alert
        
        if (newBalance < CRITICAL_THRESHOLD) {
            // CRITICAL ALERT 🔴
            const icon = "🔴 KRITIS!";
            const warningMsg = `${icon} Kantong *${formatPocketName(pocketName)}* SUDAH TINGGAL *${formatIDR(newBalance)}*!\n\n⚠️ BAHAYA OVERDRAFT! Jangan ada pengeluaran lagi sampai ada dana masuk!`;
            await ctx.replyWithMarkdown(warningMsg);
            
            // Also send email alert to family
            await sendTransactionEmailNotification({
                actor,
                amount: newBalance,
                description: `⚠️ ALERT: Kantong ${formatPocketName(pocketName)} KRITIS (${formatIDR(newBalance)})`,
                type: 'alert',
                pocketName
            }).catch(() => {});
        } else if (newBalance < LOW_FUND_THRESHOLD) {
            // WARNING ALERT 🟡
            const icon = "🟡 PERHATIAN";
            const warningMsg = `${icon} Kantong *${formatPocketName(pocketName)}* sudah kurang dari *2jt* → Sekarang *${formatIDR(newBalance)}*\n\n💡 Saran: Cek apakah perlu top-up dana dari assets lain.`;
            await ctx.replyWithMarkdown(warningMsg);
        }
        // Jika balance normal (>2jt), tidak perlu warning
    } catch (err) {
        console.error("❌ Error check low fund:", err);
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

        let saldoBersama = 0, saldoQisthi = 0, saldoGita = 0;
        let detailBersama = "", detailQisthi = "", detailGita = "";

        pockets.forEach(p => {
            const balance = Number(p.current_balance || 0);
            const icon = getPocketIcon(p.ownership);
            const cleanName = formatPocketName(p.name);
            const line = `   ${icon} ${cleanName}: *${formatIDR(balance)}*\n`;

            if (p.ownership === 'bersama') {
                saldoBersama += balance;
                detailBersama += line;
            } else if (p.ownership === 'suami') {
                saldoQisthi += balance;
                detailQisthi += line;
            } else if (p.ownership === 'istri') {
                saldoGita += balance;
                detailGita += line;
            }
        });

        const totalSemua = saldoBersama + saldoQisthi + saldoGita;

        const reportText =
            `━━━━━━━━━━━━━━━━━━━\n💰 *LAPORAN SALDO REAL-TIME*\n━━━━━━━━━━━━━━━━━━━\n
🌐 *Kantong Bersama:* *${formatIDR(saldoBersama)}*
${detailBersama}
🧑 *Kantong Qisthi:* *${formatIDR(saldoQisthi)}*
${detailQisthi}
👩 *Kantong Gita:* *${formatIDR(saldoGita)}*
${detailGita}
━━━━━━━━━━━━━━━━━━━\n📊 *Total Aset Dana:* *${formatIDR(totalSemua)}*\n━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Data real-time`;

        await ctx.replyWithMarkdown(reportText);
    } catch (err) {
        console.error("❌ Gagal load saldo:", err);
        await ctx.reply("⚠️ Gagal mengambil data saldo, Kak.");
    }
}

// ==========================================
// HELPER: Ringkasan Bulanan
// ==========================================
async function handleRingkasan(ctx: any) {
    try {
        await ctx.reply("📊 Menyusun ringkasan keuangan bulan ini...");

        const sekarang = new Date();
        const awalBulan = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1).toISOString();
        const akhirBulan = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const bulanTeks = sekarang.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

        const { data: txData } = await supabase
            .from('transactions')
            .select('amount, type, actor')
            .gte('created_at', awalBulan)
            .lte('created_at', akhirBulan);

        let totalPemasukan = 0, totalPengeluaran = 0;
        let pengeluaranQisthi = 0, pengeluaranGita = 0, pengeluaranBersama = 0;
        let totalTransaksi = txData?.length || 0;

        txData?.forEach(tx => {
            if (tx.type === 'income') totalPemasukan += Number(tx.amount);
            else if (tx.type === 'expense') {
                totalPengeluaran += Number(tx.amount);
                if (tx.actor === 'suami') pengeluaranQisthi += Number(tx.amount);
                else if (tx.actor === 'istri') pengeluaranGita += Number(tx.amount);
                else pengeluaranBersama += Number(tx.amount);
            }
        });

        const { data: bills } = await supabase
            .from('bills')
            .select('name, amount, due_date')
            .eq('status', 'unpaid')
            .order('due_date', { ascending: true });

        let tagihanText = "", totalTagihan = 0;
        if (bills && bills.length > 0) {
            bills.forEach(b => {
                totalTagihan += Number(b.amount);
                const dueDate = b.due_date ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '?';
                tagihanText += `• ${b.name}: ${formatIDR(Number(b.amount))} (Jatuh tempo: ${dueDate})\n`;
            });
        } else {
            tagihanText = "✅ Tidak ada tagihan pending\n";
        }

        const { data: installments } = await supabase
            .from('installments')
            .select('name, monthly_amount, paid_months, tenor_months, total_amount, down_payment');

        let cicilanText = "", totalCicilanBulanan = 0;
        if (installments && installments.length > 0) {
            installments.forEach(i => {
                const sisa = Number(i.tenor_months) - Number(i.paid_months);
                if (sisa > 0) {
                    const cicilan = Number(i.monthly_amount);
                    totalCicilanBulanan += cicilan;
                    const totalDibayar = Number(i.down_payment || 0) + (Number(i.paid_months) * cicilan);
                    const sisaTotal = Number(i.total_amount) - totalDibayar;
                    cicilanText += `• ${i.name}: ${formatIDR(cicilan)}/bln (${i.paid_months}/${i.tenor_months}, sisa ${formatIDR(sisaTotal)})\n`;
                }
            });
        } else {
            cicilanText = "✅ Tidak ada cicilan kredit\n";
        }

        const { data: pockets } = await supabase.from('pockets').select('name, current_balance');
        let totalSaldo = 0;
        pockets?.forEach(p => { totalSaldo += Number(p.current_balance || 0); });

        const totalKewajiban = totalTagihan + totalCicilanBulanan;
        const sisaSetelahBayar = totalSaldo - totalKewajiban;

        const ringkasan =
            `━━━━━━━━━━━━━━━━━━━\n📊 *RINGKASAN KEUANGAN*\n${bulanTeks}\n━━━━━━━━━━━━━━━━━━━\n
💰 *ARUS KAS:*
🟢 Pemasukan: *${formatIDR(totalPemasukan)}*
🔴 Pengeluaran: *${formatIDR(totalPengeluaran)}*
📈 Selisih: *${formatIDR(totalPemasukan - totalPengeluaran)}*
📝 Total Transaksi: ${totalTransaksi}

👤 *PENGELUARAN:*
🧑 Qisthi: *${formatIDR(pengeluaranQisthi)}*
👩 Gita: *${formatIDR(pengeluaranGita)}*
🌐 Bersama: *${formatIDR(pengeluaranBersama)}*

💼 *SALDO SAAT INI:* *${formatIDR(totalSaldo)}*

📋 *TAGIHAN PENDING:*
${tagihanText}

🏠 *CICILAN AKTIF:*
${cicilanText}

⚠️ *TOTAL KEWAJIBAN:* *${formatIDR(totalKewajiban)}*
💰 *SISA SETELAH BAYAR:* *${formatIDR(sisaSetelahBayar)}*
${sisaSetelahBayar < 0 ? '⚠️ PERHATIAN: Saldo tidak cukup!' : '✅ Saldo cukup untuk semua kewajiban.'}
━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Ringkasan real-time`;

        await ctx.replyWithMarkdown(ringkasan);
    } catch (err) {
        console.error("❌ Gagal ringkasan:", err);
        await ctx.reply("⚠️ Gagal menyusun ringkasan, Kak.");
    }
}

// ==========================================
// HELPER: Bayar Tagihan
// ==========================================
async function handleBayarTagihan(ctx: any, namaTagihan: string) {
    try {
        const { data: bills, error } = await supabase
            .from('bills')
            .select('*')
            .ilike('name', `%${namaTagihan}%`)
            .eq('status', 'unpaid');

        if (error) throw error;
        if (!bills || bills.length === 0) return await handleListTagihan(ctx);

        if (bills.length > 1) {
            let listText = `🤔 Ditemukan beberapa tagihan:\n\n`;
            bills.forEach((b, idx) => {
                const dueDate = b.due_date ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '?';
                listText += `${idx + 1}. *${b.name}* — ${formatIDR(Number(b.amount))} (Jatuh tempo: ${dueDate})\n`;
            });
            listText += `\nSilakan ketik lebih spesifik.\nContoh: \`bayar wifi biznet\``;
            return await ctx.replyWithMarkdown(listText);
        }

        const bill = bills[0];
        const amount = Number(bill.amount);
        const actor = ctx.state.actor;
        const encodedName = encodeURIComponent(bill.name);
        const dueDate = bill.due_date ? new Date(bill.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : 'Tidak diketahui';

        await ctx.reply(
            `━━━━━━━━━━━━━━━━━━━\n🧾 *KONFIRMASI BAYAR TAGIHAN*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `📝 *${bill.name}*\n` +
            `💰 Nominal: *${formatIDR(amount)}*\n` +
            `📅 Jatuh Tempo: ${dueDate}\n` +
            `👤 Eksekutor: ${actor === 'suami' ? '🧑 Qisthi' : '👩 Gita'}\n\n` +
            `Pilih sumber dana:`,
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
        await ctx.reply("⚠️ Error saat memproses pembayaran tagihan, Kak.");
    }
}

// ==========================================
// HELPER: Bayar Cicilan
// ==========================================
async function handleBayarCicilan(ctx: any, namaCicilan: string) {
    try {
        const { data: installments, error } = await supabase
            .from('installments')
            .select('*')
            .ilike('name', `%${namaCicilan}%`);

        if (error) throw error;
        const aktif = installments?.filter(i => Number(i.tenor_months) > Number(i.paid_months)) || [];
        if (!installments || installments.length === 0) return await handleListCicilan(ctx);
        if (aktif.length === 0) return ctx.reply(`✅ Semua cicilan dengan kata *"${namaCicilan}"* sudah lunas, Kak! 🎉`);
        if (aktif.length > 1) {
            let listText = `🤔 Ditemukan beberapa cicilan:\n\n`;
            aktif.forEach((i, idx) => {
                const sisa = Number(i.tenor_months) - Number(i.paid_months);
                listText += `${idx + 1}. *${i.name}* — ${formatIDR(Number(i.monthly_amount))}/bulan (Sisa ${sisa} bulan)\n`;
            });
            listText += `\nSilakan ketik lebih spesifik.\nContoh: \`cicil motor beat\``;
            return await ctx.replyWithMarkdown(listText);
        }

        const installment = aktif[0];
        const amount = Number(installment.monthly_amount);
        const actor = ctx.state.actor;
        const encodedName = encodeURIComponent(installment.name);
        const progressPct = Math.round((Number(installment.paid_months) / Number(installment.tenor_months)) * 100);

        await ctx.reply(
            `━━━━━━━━━━━━━━━━━━━\n🏠 *KONFIRMASI BAYAR CICILAN*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `📝 *${installment.name}*\n` +
            `💰 Nominal Bulanan: *${formatIDR(amount)}*\n` +
            `📊 Progress: ${installment.paid_months}/${installment.tenor_months} bulan (${progressPct}%)\n` +
            `👤 Eksekutor: ${actor === 'suami' ? '🧑 Qisthi' : '👩 Gita'}\n\n` +
            `Pilih sumber dana:`,
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
        await ctx.reply("⚠️ Error saat memproses pembayaran cicilan, Kak.");
    }
}

// ==========================================
// HELPER: Generate Laporan CSV
// ==========================================
async function handleLaporan(ctx: any) {
    try {
        const naturalReply = await generateNaturalResponse(
            'User minta laporan keuangan. Beri response profesional.',
            ctx.state.actor === 'suami' ? 'Qisthi' : 'Gita'
        );
        await ctx.reply(naturalReply);

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
            return await ctx.reply("ℹ️ Belum ada transaksi untuk bulan ini, Kak.");
        }

        let csvContent = "Tanggal;Deskripsi;Nominal;Tipe;Kantong;Eksekutor\n";
        txData.forEach(tx => {
            const tgl = new Date(tx.created_at).toLocaleDateString('id-ID');
            const deskripsi = tx.description.replace(/;/g, ',');
            const nominal = tx.amount;
            const tipe = tx.type === 'expense' ? 'Pengeluaran' : tx.type === 'income' ? 'Pemasukan' : 'Transfer';
            // @ts-ignore
            const namaKantong = tx.pockets?.name ? formatPocketName(tx.pockets.name) : 'Umum';
            const pelaku = tx.actor === 'suami' ? 'Qisthi' : tx.actor === 'istri' ? 'Gita' : 'Sistem';
            csvContent += `${tgl};${deskripsi};${nominal};${tipe};${namaKantong};${pelaku}\n`;
        });

        const namaFile = `Laporan_Keuangan_${sekarang.toLocaleString('id-ID', { month: 'long' })}_${sekarang.getFullYear()}.csv`;
        const streamFile = Readable.from([csvContent]);

        await ctx.replyWithDocument({
            source: streamFile,
            filename: namaFile
        }, {
            caption: `━━━━━━━━━━━━━━━━━━━\n📊 *LAPORAN KEUANGAN*\n${sekarang.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}\n━━━━━━━━━━━━━━━━━━━\n\nFile CSV siap dibuka di Excel. 🚀`
        });

    } catch (err) {
        console.error("❌ Gagal membuat laporan:", err);
        await ctx.reply("⚠️ Error saat generate laporan, Kak.");
    }
}

// ==========================================
// HELPER: Parser Manual
// ==========================================
function parseTransactionManual(text: string): { amount: number; description: string; type: string; allocated_pocket: string; actor: string; category: string; merchant: string; transaction_date: string; is_saving_goal: boolean; goal_name: string | null } | null {
    const pesan = text.toLowerCase().trim();
    const nominalMatch = pesan.match(/(\d+[.,]?\d*)\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i);
    if (!nominalMatch) return null;

    let amount = Number(nominalMatch[1].replace(',', '.'));
    const unit = nominalMatch[2]?.toLowerCase();
    if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount *= 1000;
    else if (unit === 'jt' || unit === 'juta') amount *= 1000000;
    else if (unit === 'milyar' || unit === 'miliar' || unit === 'm') amount *= 1000000000;
    if (amount <= 0 || amount > 100000000000) return null;

    let type = 'expense';
    if (/gaji|masuk|income|bonus|dapet|terima|transfer masuk/i.test(pesan)) type = 'income';
    else if (/transfer|pindah|nabung/i.test(pesan)) type = 'transfer';

    let actor = 'auto';
    if (/gita|istri|bunda|mama/i.test(pesan)) actor = 'istri';
    else if (/\bsaya\b|\baku\b|qisthi|ayah|papa/i.test(pesan)) actor = 'suami';

    let allocated_pocket = 'ASK_USER';
    if (/jajan qisthi|jajan ku|jajan saya/i.test(pesan)) allocated_pocket = 'jajan_qisthi';
    else if (/jajan gita|jajan istri/i.test(pesan)) allocated_pocket = 'jajan_gita';
    else if (/operasional/i.test(pesan)) allocated_pocket = 'operasional_utama';
    else if (/transportasi|bensin|motor|servis|parkir/i.test(pesan)) allocated_pocket = 'transportasi_dan_kendaraan';
    else if (/bayi|popok|susu|anak/i.test(pesan)) allocated_pocket = 'keperluan_bayi';
    else if (/wifi|listrik|tagihan|pln/i.test(pesan)) allocated_pocket = 'kebutuhan_rutin_bulanan';
    else if (/tabungan|investasi|emas/i.test(pesan)) allocated_pocket = 'tabungan_masa_depan';
    else if (/jajan|makan|kopi|cemilan/i.test(pesan)) allocated_pocket = 'operasional_harian';

    const cleanDesc = text.replace(/rp\.?\s*/gi, '').replace(/\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/gi, '').replace(/pake\s+.*/gi, '').replace(/dari\s+.*/gi, '').replace(/masuk\s+ke\s+.*/gi, '').trim();
    const description = cleanDesc || text.replace(/\d.*/, '').trim() || 'Transaksi';

    // Fallback Manual granular
    let category = 'lainnya';
    if (/makan|martabak|kopi|sugu/i.test(pesan)) category = 'makanan_minuman';
    else if (/laptop|hp|listrik|wifi/i.test(pesan)) category = 'elektronik';

    let merchant = 'umum';
    const storeMatch = pesan.match(/di\s+([a-zA-Z0-9_\s]+)/i);
    if (storeMatch) merchant = storeMatch[1].trim();

    const is_saving_goal = /nabung|tabungan|tabung/i.test(pesan) && !/masa depan/i.test(pesan); // Tambah kata 'tabung'
    let goal_name = null;
    if (is_saving_goal) {
        // Cari polanya, lalu ambil nama barangnya secara murni
        const goalMatch = text.match(/(?:beli|buat|tabung|nabung)\s+([a-zA-Z0-9_\s]+)/i);
        if (goalMatch) {
            // Bersihkan sisa kata kerja yang mungkin ikut terbawa oleh regex
            goal_name = goalMatch[1]
                .replace(/\d.*/, '') // Buang angka sisa nominal rupiah
                .replace(/^(beli|buat|tabung|nabung)\s+/i, '') // Buang kata "beli/buat" di depan jika ada
                .trim();
        }
    }

    return {
        amount: Math.round(amount),
        description: description.replace(/^[.,\s]+/, '').trim() || 'Transaksi',
        type,
        allocated_pocket,
        actor,
        category,
        merchant,
        transaction_date: new Date().toISOString(),
        is_saving_goal,
        goal_name
    };
}

// ==========================================
// HELPER: Get Pocket Buttons from DB
// ==========================================
async function getPocketButtons(txId: string): Promise<Array<Array<{ text: string; callback_data: string }>>> {
    try {
        const { data: pockets } = await supabase.from('pockets').select('name, ownership').order('name');
        const txData = pendingTransactions.get(txId);

        // Pilih callback prefix secara dinamis: 'sg' untuk saving goals, 'p' untuk transaksi normal
        const prefix = txData?.is_saving_goal ? 'sg' : 'p';

        if (!pockets || pockets.length === 0) {
            return [
                [{ text: '🌐 Operasional Utama', callback_data: `${prefix}:${txId}:operasional_utama` }],
                [{ text: '🧑 Jajan Qisthi', callback_data: `${prefix}:${txId}:jajan_qisthi` }],
                [{ text: '👩 Jajan Gita', callback_data: `${prefix}:${txId}:jajan_gita` }],
                [{ text: '❌ Batal', callback_data: `cancel:${txId}` }]
            ];
        }

        const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
        let currentRow: Array<{ text: string; callback_data: string }> = [];

        pockets.forEach((p, index) => {
            const icon = getPocketIcon(p.ownership);
            const cleanName = formatPocketName(p.name);
            currentRow.push({ text: `${icon} ${cleanName}`, callback_data: `${prefix}:${txId}:${p.name}` });

            if (currentRow.length === 2 || index === pockets.length - 1) {
                buttons.push([...currentRow]);
                currentRow = [];
            }
        });

        buttons.push([{ text: '❌ Batal', callback_data: `cancel:${txId}` }]);
        return buttons;
    } catch (err) {
        console.error('❌ Gagal ambil pockets:', err);
        return [[{ text: '❌ Error', callback_data: `cancel:${txId}` }]];
    }
}

// ==========================================
// HANDLER TEKS
// ==========================================
bot.on('text', async (ctx) => {
    const pesanAsli = ctx.message.text;
    const pesan = pesanAsli.toLowerCase().trim();
    const userName = ctx.state.actor === 'suami' ? 'Qisthi' : 'Gita';

    if (pesan.startsWith('/')) return;

    // BAYAR CICILAN
    if (pesan === 'cicil' || pesan === 'cicilan' || pesan === 'bayar cicilan') return await handleListCicilan(ctx);
    if (pesan.startsWith('cicil ') || pesan.startsWith('bayar cicilan ')) {
        return await handleBayarCicilan(ctx, pesan.replace(/^(cicil|bayar cicilan)\s+/, '').trim());
    }

    // BAYAR TAGIHAN
    if (pesan === 'bayar' || pesan === 'bayarin' || pesan === 'bayar tagihan' || pesan === 'tagihan') return await handleListTagihan(ctx);
    if (pesan.startsWith('bayar ') || pesan.startsWith('bayarin ')) {
        const namaTagihan = pesan.replace(/^bayar(in)?\s+/, '').trim();
        if (namaTagihan === 'cicilan') return await handleListCicilan(ctx);
        return await handleBayarTagihan(ctx, namaTagihan);
    }

    // LAPORAN CSV
    const laporanKeywords = ['laporan', 'export', 'csv', 'excel', 'download', 'kirim laporan', 'kirim file', 'laporan keuangan', 'laporan pengeluaran', 'laporan pemasukan', 'download laporan', 'riwayat transaksi', 'history', 'mutasi', 'rekap transaksi', 'laporan moni', 'export laporan', 'file laporan', 'kirim csv', 'kirim excel', 'bikinin laporan', 'buatin laporan', 'minta laporan', 'export data', 'download data'];
    if (laporanKeywords.some(k => pesan.includes(k))) return await handleLaporan(ctx);

    // SALDO
    const saldoKeywords = ['cek saldo', 'saldo', 'lihat saldo', 'saldo gw', 'sisa saldo', 'sisa uang', 'cek duit', 'uang sekarang'];
    if (saldoKeywords.some(k => pesan.includes(k))) {
        const naturalReply = await generateNaturalResponse('User minta cek saldo.', userName);
        await ctx.reply(naturalReply);
        return await handleCekSaldo(ctx);
    }

    // RINGKASAN
    const ringkasanKeywords = ['ringkasan', 'rekap', 'rangkuman', 'summary', 'overview', 'ikhtisar', 'bulan ini', 'rangkum'];
    if (ringkasanKeywords.some(k => pesan.includes(k))) return await handleRingkasan(ctx);

    // HELP & COMMANDS MENU
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
            link_preview_options: { is_disabled: true } // Standard Telegraf v4+ murni
        });
    }

    // ─── 🛠️ AMANKAN LOGIC CEK TABUNGAN DI SINI (TARUH DI ATAS BEGALAN REGEX) ───
    const cekTabunganKeywords = ['cek tabungan', 'progres impian', 'progres tabungan', 'target tabungan', 'lihat tabungan', 'list tabungan', 'celengan'];
    if (cekTabunganKeywords.some(k => pesan.includes(k))) {
        await ctx.reply("🔍 Menarik data target celengan keluarga dari database...");
        
        try {
            // Tarik data target tabungan yang masih aktif dari Supabase
            const { data: goals, error } = await supabase
                .from('saving_goals')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!goals || goals.length === 0) {
                return await ctx.reply("🎯 Belum ada target impian aktif yang tercatat di database nih, Cuy. Yuk buat target baru via Dashboard Web!");
            }

            let reportText = `━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 *PROGRESS TARGET CELENGAN KELUARGA* \n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            goals.forEach((g, idx) => {
                const current = Number(g.current_amount || 0);
                const target = Number(g.target_amount || 0);
                const progressPct = Math.min(Math.round((current / target) * 100), 100);
                
                // Format sisa tenggat jika ada kolom deadline (gunakan g.deadline sesuai schema DB lu)
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
            console.error("❌ Gagal mengambil list tabungan via Telegram:", err);
            return await ctx.reply("⚠️ Waduh, Moni gagal menarik data tabungan. Sila cek koneksi database Supabase lu.");
        }
    }

    // SAPAAN
    const sapaanKeywords = ['hai', 'halo', 'hello', 'hi', 'woi', 'eh', 'p', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'test', 'tes', 'oy', 'oi', 'hallo', 'hy', 'yo', 'wow'];
    if (sapaanKeywords.some(k => pesan === k || pesan.startsWith(k + ' ') || pesan.endsWith(' ' + k))) {
        const naturalReply = await generateNaturalResponse(`User "${userName}" menyapa: "${pesanAsli}".`, userName);
        return await ctx.reply(naturalReply);
    }

    // PERTANYAAN UMUM
    const tanyaKeywords = ['apa kabar', 'gimana', 'bagaimana', 'lagi apa', 'kamu siapa', 'lagi ngapain', 'sehat', 'baik'];
    if (tanyaKeywords.some(k => pesan.includes(k))) {
        const naturalReply = await generateNaturalResponse(`User tanya: "${pesanAsli}".`, userName);
        return await ctx.reply(naturalReply);
    }

    // TRANSAKSI & SAVING GOALS DETECTION
    const punyaNominal = /\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i.test(pesan);
    const transaksiKeywords = /beli|bayar|jajan|makan|minum|belanja|transfer|masuk|gaji|bonus|topup|isi|pulsa|servis|bensin|parkir|nabung|tabungan|tabung/i.test(pesan);
    const isKemungkinanTransaksi = punyaNominal || transaksiKeywords;

    if (isKemungkinanTransaksi) {
        await ctx.reply("⏳ Sebentar, Moni proses transaksinya...");

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

            // RENDER INTERAKTIF JIKA INTENTNYA ADALAH SAVING GOALS (FITUR 4)
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
                // RENDER TRANSAKSI BELANJA GRANULAR NORMAL (FITUR 1)
                const tipeText = type === 'income' ? 'Pemasukan' : type === 'expense' ? 'Pengeluaran' : 'Transfer';
                const tipeEmoji = type === 'income' ? '🟢' : type === 'expense' ? '🔴' : '🔵';
                const dateText = new Date(transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

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
        } else {
            await ctx.reply(
                "━━━━━━━━━━━━━━━━━━━\n🤔 *Moni tidak mengerti*\n━━━━━━━━━━━━━━━━━━━\n\n" +
                "Tidak dapat menemukan nominal transaksi.\n\n" +
                "📝 *Format yang benar:*\n" +
                "• \"Beli kopi 35rb\"\n" +
                "• \"Gaji masuk 5jt\"\n" +
                "• \"Nabung beli kulkas 700rb\"\n\n" +
                "💡 Ketik *help* untuk bantuan.",
                { parse_mode: 'Markdown' }
            );
        }
        return;
    }

    // DEFAULT
    const naturalReply = await generateNaturalResponse(`User berkata: "${pesanAsli}". Arahkan ke "help" jika tidak mengerti.`, userName);
    return await ctx.reply(naturalReply);
});

// ==========================================
// CALLBACK QUERY
// ==========================================
bot.on('callback_query', async (ctx) => {
    // @ts-ignore
    const callbackData = ctx.callbackQuery.data;
    if (!callbackData) return;

 if (callbackData.startsWith('p:')) {
        await ctx.answerCbQuery("⏳ Memproses...");
        const parts = callbackData.split(':');
        const txId = parts[1];
        const selectedPocket = parts[2];

        const txData = pendingTransactions.get(txId);
        if (!txData) { await ctx.answerCbQuery("❌ Data expired."); return; }

        const { amount, actor, description, type, category, merchant, transaction_date } = txData;
        pendingTransactions.delete(txId);

        try {
            // Tarik data kantong lengkap dengan asset_id relasi induknya murni
            const { data: pocketData } = await supabase
                .from('pockets')
                .select('id, ownership, current_balance, asset_id') // <-- SUNTIK asset_id & current_balance
                .eq('name', selectedPocket)
                .single();
                
            const finalPocketId = pocketData?.id || 1;
            const linkedAssetId = pocketData?.asset_id; // <-- AMBIL RELASI INDUKNYA
            const transactionType = type || 'expense';
            const modifier = transactionType === 'expense' ? -1 : 1;

            // A. EKSEKUSI TRANSAKSI JOURNAL UTAMA
            const { error: dbError } = await supabase.from('transactions').insert([{
                amount,
                description,
                type: transactionType,
                pocket_id: finalPocketId,
                asset_id: linkedAssetId || 1, // <-- GUNAKAN ASSET ID YANG RELASIONAL, BUKAN HARDCODE 1
                actor,
                category: category || 'lainnya',
                merchant: merchant || 'umum',
                created_at: transaction_date || new Date().toISOString()
            }]);
            if (dbError) throw dbError;

            // B. UPDATE SALDO BERJALAN DI KANTONG (POCKETS)
            if (pocketData) {
                await supabase.from('pockets')
                    .update({ current_balance: Number(pocketData.current_balance) + (amount * modifier) })
                    .eq('id', finalPocketId);
            }

            // C. 🆕 SUNTIKAN PERBAIKAN: POTONG REKENING INDUK (ASSETS) SECARA REAL-TIME BULLETPROOF
            if (linkedAssetId) {
                const { data: assetData } = await supabase
                    .from('assets')
                    .select('balance')
                    .eq('id', linkedAssetId)
                    .single();

                if (assetData) {
                    await supabase.from('assets')
                        .update({ balance: Number(assetData.balance) + (amount * modifier) })
                        .eq('id', linkedAssetId);
                }
            }

            // D. 🚨 CHECK LOW FUND WARNING (NEW!)
            const newPocketBalance = Number(pocketData?.current_balance || 0) + (amount * modifier);
            await checkAndNotifyLowFund(ctx, selectedPocket, newPocketBalance, actor);

            const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            const aiStatus = getAIStatus();
            const pocketIcon = getPocketIcon(pocketData?.ownership || 'bersama');
            const cleanPocket = formatPocketName(selectedPocket);
            const dateText = new Date(transaction_date || new Date()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            await ctx.editMessageText(
                `━━━━━━━━━━━━━━━━━━━\n✅ *TRANSAKSI BERHASIL*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                `📝 *${description}*\n` +
                `💰 Nominal: *${formatIDR(amount)}*\n` +
                `🏬 Toko: *${merchant || 'umum'}*\n` +
                `🏷️ Kategori: *${(category || 'lainnya').replace('_', ' ')}*\n` +
                `📅 Tanggal: *${dateText}*\n` +
                `🔄 Jenis: ${type === 'expense' ? '🔴 Pengeluaran' : type === 'income' ? '🟢 Pemasukan' : '🔵 Transfer'}\n` +
                `📂 Kantong: ${pocketIcon} ${cleanPocket}\n` +
                `👤 Eksekutor: ${actorEmoji}\n` +
                `🧠 AI: ${aiStatus}\n\n` +
                `━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Tersimpan aman`,
                { parse_mode: 'Markdown' }
            );

            sendTransactionEmailNotification({ actor, amount, description, type: transactionType, pocketName: selectedPocket })
                .catch(err => console.error('❌ Email gagal:', err));
        } catch (error) {
            console.error("❌ Callback error:", error);
            await ctx.editMessageText("❌ Gagal menyimpan, coba lagi.").catch(() => { });
        }
    }
    // INTERSEPTOR CALLBACK QUERY BARU KHUSUS PROSES SAVING GOALS (FITUR 4)
else if (callbackData.startsWith('sg:')) {
        await ctx.answerCbQuery("⏳ Memproses Tabungan...");
        const parts = callbackData.split(':');
        const txId = parts[1];
        const selectedPocket = parts[2];

        const txData = pendingTransactions.get(txId);
        if (!txData) { await ctx.answerCbQuery("❌ Data expired."); return; }

        const { amount, actor, goal_name } = txData;
        pendingTransactions.delete(txId);

        try {
            const cleanedGoalName = goal_name ? goal_name.replace(/^(beli|buat|untuk|tabung|nabung)\s+/i, '').trim() : '';

            let { data: goal, error: gError } = await supabase
                .from('saving_goals')
                .select('*')
                .ilike('name', cleanedGoalName)
                .eq('status', 'active')
                .maybeSingle();

            if (!goal) {
                const { data: newGoal, error: createGoalErr } = await supabase
                    .from('saving_goals')
                    .insert([{ name: goal_name, target_amount: 5000000, current_amount: 0, status: 'active' }])
                    .select()
                    .single();
                if (createGoalErr) throw createGoalErr;
                goal = newGoal;
            }

            // A. AMBIL DATA KANTONG DANA ASAL BESERTA ASSET_ID RELASINYA MURNI
            const { data: pocketData } = await supabase
                .from('pockets')
                .select('id, current_balance, asset_id') // <-- AMBIL KOLOM asset_id NYA JUGA
                .eq('name', selectedPocket)
                .single();
                
            if (!pocketData) throw new Error('Kantong asal tidak valid.');

            const finalPocketId = pocketData.id;
            const linkedAssetId = pocketData.asset_id; // <-- SIMPAN ID RELASI ASSET INDUKNYA

            // B. CATAT KE SAVING LOGS TABUNGAN
            const { error: logErr } = await supabase.from('saving_logs').insert([{
                goal_id: goal.id,
                amount,
                source_pocket_id: finalPocketId,
                actor
            }]);
            if (logErr) throw logErr;

            // C. UPDATE NOMINAL TERKUMPUL DI CELENGAN
            const newGoalAmount = Number(goal.current_amount || 0) + amount;
            const isAchieved = newGoalAmount >= Number(goal.target_amount);
            await supabase.from('saving_goals')
                .update({ current_amount: newGoalAmount, status: isAchieved ? 'achieved' : 'active' })
                .eq('id', goal.id);

            // D. UPDATE SALDO BERKURANG DI KANTONG (POCKETS)
            await supabase.from('pockets')
                .update({ current_balance: Number(pocketData.current_balance) - amount })
                .eq('id', finalPocketId);

            // E. 🆕 SUNTIKAN PERBAIKAN: POTONG SALDO REKENING INDUK (ASSETS) SAAT NABUNG JUGA BIAR NET WORTH DI WEB SINKRON!
            if (linkedAssetId) {
                const { data: assetData } = await supabase
                    .from('assets')
                    .select('balance')
                    .eq('id', linkedAssetId)
                    .single();

                if (assetData) {
                    await supabase.from('assets')
                        .update({ balance: Number(assetData.balance) - amount })
                        .eq('id', linkedAssetId);
                }
            }

            // F. 🚨 CHECK LOW FUND WARNING
            const newPocketBalance = Number(pocketData.current_balance) - amount;
            await checkAndNotifyLowFund(ctx, selectedPocket, newPocketBalance, actor);

            // G. MASUKKAN SEBAGAI MUTASI DI JOURNAL UTAMA
            await supabase.from('transactions').insert([{
                amount,
                description: `Setoran tabungan: ${goal.name}`,
                type: 'transfer',
                pocket_id: finalPocketId,
                asset_id: linkedAssetId || 1, // <-- Gunakan dinamis linkedAssetId hasil mapping
                category: 'investasi_tabungan',
                merchant: 'Moni Saving'
            }]);

            const progressPct = Math.min(Math.round((newGoalAmount / Number(goal.target_amount)) * 100), 100);
            const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';

            await ctx.editMessageText(
                `━━━━━━━━━━━━━━━━━━━\n🎯 *SETORAN TABUNGAN SUKSES*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                `📦 Target: *${goal.name}*\n` +
                `💰 Nominal: *${formatIDR(amount)}*\n` +
                `📂 Sumber: *${formatPocketName(selectedPocket)}*\n` +
                `📊 Progress: *${formatIDR(newGoalAmount)}* / ${formatIDR(Number(goal.target_amount))} (*${progressPct}%*)\n` +
                `👤 Pengirim: ${actorEmoji}\n\n` +
                `${isAchieved ? '🎉 GOKIL LU CUY! Target tabungan ini sudah terpenuhi 100%. Siap dibeli! 🛍️' : '🚀 Semangat, kumpulkan terus jatah celengan lu berdua!'}`
            );
        } catch (err) {
            console.error("❌ Saving goal callback error:", err);
            await ctx.editMessageText("❌ Gagal memproses tabungan.").catch(() => { });
        }
    }
    else if (callbackData.startsWith('paybill:')) {
        await ctx.answerCbQuery("⏳ Memproses...");
        const parts = callbackData.split(':');
        const amount = Number(parts[1]);
        const actor = parts[2];
        const selectedPocket = parts[3];
        const encodedName = parts[4];
        const billId = parts[5];
        const billName = decodeURIComponent(encodedName);

        try {
            await supabase.from('bills').update({ status: 'paid', last_paid_at: new Date().toISOString() }).eq('id', billId);
            const { data: pocketData } = await supabase.from('pockets').select('id, current_balance, asset_id').eq('name', selectedPocket).single();
            const finalPocketId = pocketData?.id || 1;
            const linkedAssetId = pocketData?.asset_id;

            // Sertifikasi kolom granular saat bayar tagihan rutin (DENGAN ASSET_ID YANG BENAR)
            await supabase.from('transactions').insert([{
                amount,
                description: `Bayar tagihan: ${billName}`,
                type: 'expense',
                pocket_id: finalPocketId,
                asset_id: linkedAssetId || 1,
                actor,
                category: 'tagihan_rutin',
                merchant: billName
            }]);

            const { data: cp } = await supabase.from('pockets').select('current_balance').eq('id', finalPocketId).single();
            if (cp) await supabase.from('pockets').update({ current_balance: Number(cp.current_balance) - amount }).eq('id', finalPocketId);
            
            // 🆕 KURANGI ASSETS SOURCE JUGA (FIX KRITIS!)
            if (linkedAssetId) {
                const { data: assetData } = await supabase.from('assets').select('balance').eq('id', linkedAssetId).single();
                if (assetData) {
                    await supabase.from('assets').update({ balance: Number(assetData.balance) - amount }).eq('id', linkedAssetId);
                }
            }

            // 🚨 CHECK LOW FUND WARNING
            const newPocketBalance = (cp?.current_balance || 0) - amount;
            await checkAndNotifyLowFund(ctx, selectedPocket, newPocketBalance, actor);

            const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            await ctx.editMessageText(
                `━━━━━━━━━━━━━━━━━━━\n✅ *TAGIHAN LUNAS!*\n━━━━━━━━━━━━━━━━━━━\n\n📝 ${billName}\n💰 ${formatIDR(amount)}\n🏬 Merchant: *${billName}*\n🏷️ Kategori: *tagihan rutin*\n📂 ${formatPocketName(selectedPocket)}\n👤 ${actorEmoji}\n\n🎉 Tagihan berhasil dibayar!`,
                { parse_mode: 'Markdown' }
            );
            sendTransactionEmailNotification({ actor, amount, description: `Bayar tagihan: ${billName}`, type: 'expense', pocketName: selectedPocket }).catch(() => { });
        } catch (error) {
            console.error("❌ Paybill error:", error);
            await ctx.editMessageText("❌ Gagal bayar tagihan.").catch(() => { });
        }
    }
    else if (callbackData.startsWith('payinstall:')) {
        await ctx.answerCbQuery("⏳ Memproses...");
        const parts = callbackData.split(':');
        const amount = Number(parts[1]);
        const actor = parts[2];
        const selectedPocket = parts[3];
        const encodedName = parts[4];
        const installmentId = parts[5];
        const installmentName = decodeURIComponent(encodedName);

        try {
            const { data: inst } = await supabase.from('installments').select('paid_months').eq('id', installmentId).single();
            if (!inst) { await ctx.answerCbQuery("❌ Data tidak ditemukan."); return; }
            const newPaidMonths = Number(inst.paid_months) + 1;
            await supabase.from('installments').update({ paid_months: newPaidMonths }).eq('id', installmentId);
            const { data: pocketData } = await supabase.from('pockets').select('id, current_balance, asset_id').eq('name', selectedPocket).single();
            const finalPocketId = pocketData?.id || 1;
            const linkedAssetId = pocketData?.asset_id;

            // Sertifikasi kolom granular saat bayar cicilan kredit (DENGAN ASSET_ID YANG BENAR)
            await supabase.from('transactions').insert([{
                amount,
                description: `Bayar cicilan: ${installmentName} (Bln ke-${newPaidMonths})`,
                type: 'expense',
                pocket_id: finalPocketId,
                asset_id: linkedAssetId || 1,
                actor,
                category: 'tagihan_rutin',
                merchant: installmentName
            }]);

            const { data: cp } = await supabase.from('pockets').select('current_balance').eq('id', finalPocketId).single();
            if (cp) await supabase.from('pockets').update({ current_balance: Number(cp.current_balance) - amount }).eq('id', finalPocketId);
            
            // 🆕 KURANGI ASSETS SOURCE JUGA (FIX KRITIS!)
            if (linkedAssetId) {
                const { data: assetData } = await supabase.from('assets').select('balance').eq('id', linkedAssetId).single();
                if (assetData) {
                    await supabase.from('assets').update({ balance: Number(assetData.balance) - amount }).eq('id', linkedAssetId);
                }
            }

            // 🚨 CHECK LOW FUND WARNING
            const newPocketBalance = (cp?.current_balance || 0) - amount;
            await checkAndNotifyLowFund(ctx, selectedPocket, newPocketBalance, actor);

            const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            await ctx.editMessageText(
                `━━━━━━━━━━━━━━━━━━━\n✅ *CICILAN DIBAYAR!*\n━━━━━━━━━━━━━━━━━━━\n\n📝 ${installmentName}\n💰 ${formatIDR(amount)}\n📊 Bulan ke-${newPaidMonths}\n📂 ${formatPocketName(selectedPocket)}\n👤 ${actorEmoji}\n\n🏠 Satu bulan lagi terbayar!`,
                { parse_mode: 'Markdown' }
            );
            sendTransactionEmailNotification({ actor, amount, description: `Bayar cicilan: ${installmentName}`, type: 'expense', pocketName: selectedPocket }).catch(() => { });
        } catch (error) {
            console.error("❌ Payinstall error:", error);
            await ctx.editMessageText("❌ Gagal bayar cicilan.").catch(() => { });
        }
    }
    else if (callbackData.startsWith('cancel:')) {
        pendingTransactions.delete(callbackData.split(':')[1]);
        await ctx.answerCbQuery("Dibatalkan.");
        await ctx.editMessageText("❌ Transaksi dibatalkan.").catch(() => { });
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
        await ctx.reply("📸 Moni sedang membaca struk...");
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
        const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer', timeout: 10000 });
        const imageBuffer = Buffer.from(response.data);
        const hasilParse = await parseFinancialImage(imageBuffer, 'image/jpeg');

        if (hasilParse) {
            const { amount, description, type, actor: aiActor, category, merchant, transaction_date } = hasilParse;
            const finalActor = aiActor === 'auto' ? ctx.state.actor : aiActor;

            const txId = 'img' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
            pendingTransactions.set(txId, {
                amount, actor: finalActor, description, type, timestamp: Date.now(),
                category, merchant, transaction_date
            });

            const formattedAmount = formatIDR(amount);
            const actorEmojiPreview = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            const keyboardButtons = await getPocketButtons(txId);
            const dateText = new Date(transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            await ctx.reply(
                `━━━━━━━━━━━━━━━━━━━\n💳 *KONFIRMASI ALOKASI DANA (STRUK)*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                `📝 *${description}*\n` +
                `💰 Nominal: *${formattedAmount}*\n` +
                `🏬 Toko: *${merchant}*\n` +
                `🏷️ Kategori: *${category.replace('_', ' ')}*\n` +
                `📅 Tanggal: *${dateText}*\n` +
                `🔴 Tipe: *Pengeluaran*\n` +
                `👤 Oleh: ${actorEmojiPreview}\n\n` +
                `Pilih sumber dana:`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboardButtons } }
            );
            return;
        } else {
            await ctx.reply(
                "━━━━━━━━━━━━━━━━━━━\n❌ *GAGAL MEMBACA STRUK*\n━━━━━━━━━━━━━━━━━━━\n\n" +
                "Moni tidak dapat membaca struk ini.\n\n" +
                "📝 *Alternatif:* Ketik manual\n" +
                "Contoh: \"Belanja di Indomaret 85rb\"",
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        console.error("❌ Error foto:", error);
        await ctx.reply("❌ Gangguan teknis saat membaca struk.");
    }
});

// ==========================================
// COMMANDS
// ==========================================
bot.command('saldo', async (ctx) => { await ctx.reply("🔍 Memeriksa saldo..."); return await handleCekSaldo(ctx); });
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