import { supabase } from '../../config/supabaseClient.js';
import { formatIDR } from '../../helpers/formatters.js';
// 📌 IMPLEMENTASI UTUH: Kedua service ini kita hidupkan dan gunakan di dalam logic!
import { sendTransactionEmailNotification } from '../../services/notificationService.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';

// Helper internal untuk menghitung tanggal jatuh tempo dinamis berdasarkan int4 hari ini
function dapatkanTanggalJatuhTempo(hariJatuhTempo: number): string {
    const hariIni = new Date(); // Mendeteksi waktu riil sistem (Juni 2026)
    let tahun = hariIni.getFullYear();
    let bulan = hariIni.getMonth(); // 0 = Jan, 5 = Juni, dst.

    // Buat objek tanggal jatuh tempo untuk bulan berjalan
    let tanggalTarget = new Date(tahun, bulan, hariJatuhTempo);

    // Jika hari ini sudah melewati tanggal jatuh tempo bulan ini, arahkan ke bulan depan
    if (hariIni.getDate() > hariJatuhTempo) {
        tanggalTarget.setMonth(bulan + 1);
    }

    return tanggalTarget.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function handleListTagihan(ctx: any) {
    try {
        const { data: bills, error } = await supabase
            .from('bills')
            .select('name, amount, due_date')
            .eq('status', 'unpaid')
            .order('due_date', { ascending: true });

        if (error) throw error;

        if (!bills || bills.length === 0) {
            return ctx.reply('✅ Tidak ada tagihan pending, Kak! Keuangan aman terkendali.');
        }

        let totalTagihan = 0;
        let listText = '━━━━━━━━━━━━━━━━━━━\n📋 *DAFTAR TAGIHAN BELUM DIBAYAR*\n━━━━━━━━━━━━━━━━━━━\n\n';
        
        bills.forEach((b, i) => {
            totalTagihan += Number(b.amount);
            
            // Deteksi dinamis tanggal jatuh tempo dari integer int4 database
            const dueDate = b.due_date
                ? dapatkanTanggalJatuhTempo(Number(b.due_date))
                : 'Tgl tidak diketahui';
                
            listText += `${i + 1}. *${b.name}*\n   💰 ${formatIDR(Number(b.amount))} | 📅 Jatuh tempo: ${dueDate}\n\n`;
        });
        listText += `━━━━━━━━━━━━━━━━━━━\n⚠️ *Total Tagihan: ${formatIDR(totalTagihan)}*\n\n`;
        listText += 'Ketik `bayar [nama tagihan]` untuk melunasi.';

        await ctx.replyWithMarkdown(listText);
    } catch (err) {
        console.error('❌ Gagal list tagihan:', err);
        await ctx.reply('⚠️ Gagal mengambil data tagihan, Kak.');
    }
}

export async function handleBayarTagihan(ctx: any, namaTagihan: string) {
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
                const dueDate = b.due_date ? dapatkanTanggalJatuhTempo(Number(b.due_date)) : '?';
                listText += `${idx + 1}. *${b.name}* — ${formatIDR(Number(b.amount))} (Jatuh tempo: ${dueDate})\n`;
            });
            listText += '\nSilakan ketik lebih spesifik.\nContoh: `bayar wifi biznet`';
            return await ctx.replyWithMarkdown(listText);
        }

        const bill = bills[0];
        const amount = Number(bill.amount);
        const actor = ctx.state.actor || 'suami';
        const encodedName = encodeURIComponent(bill.name);
        
        // Sinkronisasi tanggal jatuh tempo dinamis pada menu konfirmasi
        const dueDate = bill.due_date ? dapatkanTanggalJatuhTempo(Number(bill.due_date)) : 'Tidak diketahui';

        // Ambil data pockets + join assets induk untuk kebutuhan visual button custom ringkas lu
        const { data: pockets } = await supabase
            .from('pockets')
            .select(`
                id, 
                name, 
                display_name, 
                current_balance, 
                ownership,
                assets (
                    name
                )
            `)
            .order('name');

        const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
        if (pockets && pockets.length > 0) {
            
            pockets.forEach((p) => {
                const currentBalance = Number(p.current_balance || 0);
                const balanceText = formatIDR(currentBalance);
                
                // @ts-ignore
                const assetName = p.assets?.name || 'Umum';

                // 📌 IMPLEMENTASI 1: Jalankan checkAndNotifyLowFund secara pasif sebelum user klik tombol
                // Jika saldo di pocket kurang dari nominal tagihan harian, pasang alert emoji (⚠️)
                const lowFundWarning = currentBalance < amount ? '⚠️ ' : '';
                
                if (currentBalance < amount) {
                    checkAndNotifyLowFund(ctx, p.display_name || p.name, currentBalance, actor)
                        .catch(err => console.error('❌ Gagal trigger alert low fund:', err));
                }

                // 📌 IMPLEMENTASI LAYOUT CUSTOM RINGKAS: Sembunyikan nama pocket, langsung Asset | Saldo
                const buttonText = `${lowFundWarning}🏦 ${assetName} | ${balanceText}`;
                
                inline_keyboard.push([{
                    text: buttonText,
                    callback_data: `paybill:${amount}:${actor}:${p.id}:${encodedName}:${bill.id}`
                }]);
            });
        } else {
            inline_keyboard.push([{ text: '🏦 Operasional Utama', callback_data: `paybill:${amount}:${actor}:1:${encodedName}:${bill.id}` }]);
        }
        inline_keyboard.push([{ text: '❌ Batal', callback_data: 'cancel_bill' }]);

        // 📌 IMPLEMENTASI 2: Kirim email notifikasi bahwa transaksi tagihan baru saja dipicu oleh aktor aktif
        sendTransactionEmailNotification({ 
            actor, 
            amount, 
            description: `Membuka Menu Bayar Tagihan: ${bill.name}`, 
            type: 'expense', 
            pocketName: 'System Check' 
        }).catch(err => console.error('❌ Notifikasi email pemicu tagihan gagal:', err));

        await ctx.reply(
            '━━━━━━━━━━━━━━━━━━━\n🧾 *KONFIRMASI BAYAR TAGIHAN*\n━━━━━━━━━━━━━━━━━━━\n\n' +
            `📝 *${bill.name}*\n` +
            `💰 Nominal: *${formatIDR(amount)}*\n` +
            `📅 Jatuh Tempo: ${dueDate}\n` +
            `👤 Eksekutor: ${actor === 'suami' ? '🧑 Qisthi' : '👩 Gita'}\n\n` +
            'Pilih sumber dana:',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard
                }
            }
        );
    } catch (err) {
        console.error('❌ Gagal bayar tagihan:', err);
        await ctx.reply('⚠️ Error saat memproses pembayaran tagihan, Kak.');
    }
}