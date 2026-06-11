import { supabase } from '../config/supabaseClient.js';

// Fungsi kirim notif ke Telegram (dipanggil dari index.ts)
let botInstance: any = null;

export function setBotInstance(bot: any) {
    botInstance = bot;
}

// ==========================================
// CEK TAGIHAN YANG AKAN JATUH TEMPO
// ==========================================
export async function checkDueBills() {
    try {
        if (!botInstance) {
            console.log('⚠️ Cron: Bot instance belum di-set, menunda notifikasi tagihan.');
            return;
        }

        const sekarang = new Date();
        
        // Dapatkan rentang tanggal hari dari hari ini hingga 7 hari ke depan (mengatasi wrap-around akhir bulan)
        const targetDays: number[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sekarang.getTime() + i * 24 * 60 * 60 * 1000);
            targetDays.push(d.getDate());
        }

        console.log(`🔍 Cron: Memeriksa tagihan/paylater jatuh tempo untuk tanggal-tanggal: ${targetDays.join(', ')}`);

        // Ambil semua tagihan unpaid
        const { data: bills, error } = await supabase
            .from('bills')
            .select('*')
            .eq('status', 'unpaid');

        if (error) throw error;

        if (!bills || bills.length === 0) {
            console.log('✅ Tidak ada tagihan unpaid di database.');
            return;
        }

        // Filter tagihan yang due_date nya jatuh pada targetDays
        const dueBills = bills.filter(bill => {
            const dueDay = bill.due_date !== undefined && bill.due_date !== null ? Number(bill.due_date) : 1;
            return targetDays.includes(dueDay);
        });

        if (dueBills.length === 0) {
            console.log('✅ Tidak ada tagihan/paylater yang mendekati jatuh tempo dalam 7 hari ini.');
            return;
        }

        console.log(`📋 Ditemukan ${dueBills.length} tagihan/paylater mendekati jatuh tempo.`);

        // Kirim notif ke Telegram untuk setiap tagihan yang due
        for (const bill of dueBills) {
            const dueDay = bill.due_date !== undefined && bill.due_date !== null ? Number(bill.due_date) : 1;
            
            // Hitung tanggal jatuh tempo aktual (bulan berjalan atau bulan depan)
            const tahunSekarang = sekarang.getFullYear();
            const bulanSekarang = sekarang.getMonth();
            const tanggalSekarang = sekarang.getDate();

            let tanggalTarget = new Date(tahunSekarang, bulanSekarang, dueDay);
            if (tanggalSekarang > dueDay) {
                tanggalTarget.setMonth(bulanSekarang + 1);
            }

            const diffTime = tanggalTarget.getTime() - sekarang.getTime();
            const sisaHari = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            
            const dueDateText = tanggalTarget.toLocaleDateString('id-ID', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });

            // Bedakan notifikasi antara Paylater/CC dengan Tagihan biasa
            const isPaylater = /paylater|kredivo|akulaku|cc|credit|kartu kredit|bnpl|g-cash|gcash/i.test(bill.name);
            const emoji = isPaylater ? '💳' : '🧾';
            const title = isPaylater ? 'PENGINGAT PAYLATER!' : 'PENGINGAT TAGIHAN!';

            const pesan = `
${emoji} **${title}** ${emoji}
━━━━━━━━━━━━━━━━━━━
📝 *${bill.name}*
💰 Nominal: *Rp${Number(bill.amount).toLocaleString('id-ID')}*
📅 Jatuh Tempo: *${dueDateText}*
⏰ Sisa: *${sisaHari} hari lagi*

Jangan lupa bayar ya, Cuy! 🚀
            `;

            // Kirim ke semua user terdaftar
            const allowedUsers = JSON.parse(process.env.ALLOWED_USERS || '{}');
            for (const chatId of Object.keys(allowedUsers)) {
                try {
                    await botInstance.telegram.sendMessage(chatId, pesan.trim(), { parse_mode: 'Markdown' });
                    console.log(`✅ Notif tagihan terkirim ke ${chatId}: ${bill.name}`);
                } catch (err) {
                    console.error(`❌ Gagal kirim ke ${chatId}:`, err);
                }
            }
        }

    } catch (err) {
        console.error('❌ Error cron tagihan:', err);
    }
}

// ==========================================
// CEK CICILAN YANG AKAN JATUH TEMPO
// ==========================================
export async function checkDueInstallments() {
    try {
        if (!botInstance) {
            console.log('⚠️ Cron: Bot instance belum di-set, menunda notifikasi cicilan.');
            return;
        }

        const sekarang = new Date();
        const sekarangEpoch = Math.floor(sekarang.getTime() / 1000);

        console.log('🔍 Cron: Cek cicilan aktif...');

        // Ambil semua cicilan yang belum lunas
        const { data: installments, error } = await supabase
            .from('installments')
            .select('*');

        if (error) throw error;

        if (!installments || installments.length === 0) {
            console.log('✅ Tidak ada cicilan.');
            return;
        }

        const aktif = installments.filter(i => Number(i.tenor_months) > Number(i.paid_months));
        
        if (aktif.length === 0) {
            console.log('✅ Semua cicilan sudah lunas.');
            return;
        }

        // Cek cicilan yang perlu dibayar bulan ini (asumsi due_date dari created_at + paid_months)
        // Kita ingetin setiap awal bulan atau setiap 30 hari
        for (const installment of aktif) {
            const sisaBulan = Number(installment.tenor_months) - Number(installment.paid_months);
            const nominal = Number(installment.monthly_amount);
            
            // Cek apakah sudah waktunya bayar bulan ini (setiap tanggal 1 atau 25)
            const tanggalSekarang = sekarang.getDate();
            const hariNotifikasi = [1, 5, 10, 15, 20, 25]; // Tanggal-tanggal pengingat
            
            if (hariNotifikasi.includes(tanggalSekarang)) {
                const pesan = `
🏠 **PENGINGAT CICILAN!** 🏠
━━━━━━━━━━━━━━━━━━━
📝 *${installment.name}*
💰 Nominal Bulanan: *Rp${nominal.toLocaleString('id-ID')}*
📊 Progress: *${installment.paid_months}/${installment.tenor_months}* bulan
⏰ Sisa: *${sisaBulan} bulan lagi*
💵 Sisa Total: *Rp${(Number(installment.total_amount) - Number(installment.down_payment) - (Number(installment.paid_months) * nominal)).toLocaleString('id-ID')}*

Jangan lupa bayar cicilannya, Cuy! 🚀
                `;

                const allowedUsers = JSON.parse(process.env.ALLOWED_USERS || '{}');
                for (const chatId of Object.keys(allowedUsers)) {
                    try {
                        await botInstance.telegram.sendMessage(chatId, pesan, { parse_mode: 'Markdown' });
                        console.log(`✅ Notif cicilan terkirim ke ${chatId}: ${installment.name}`);
                    } catch (err) {
                        console.error(`❌ Gagal kirim ke ${chatId}:`, err);
                    }
                }
                
                break; // Kirim sekali aja per hari
            }
        }

    } catch (err) {
        console.error('❌ Error cron cicilan:', err);
    }
}

// ==========================================
// JALANKAN SEMUA CRON
// ==========================================
export function startCronJobs() {
    console.log('⏰ Memulai Cron Job Scheduler...');
    
    // Jalankan setiap jam 7 pagi
    const jamTarget = 7;
    
    setInterval(() => {
        const sekarang = new Date();
        if (sekarang.getHours() === jamTarget) {
            console.log('🕖 Cron: Jam 7 pagi - Cek tagihan & cicilan...');
            checkDueBills();
            checkDueInstallments();
        }
    }, 60 * 60 * 1000); // Cek setiap 1 jam

    // Juga jalankan sekali saat startup
    console.log('🔍 Cron: Pengecekan awal...');
    checkDueBills();
    checkDueInstallments();
}