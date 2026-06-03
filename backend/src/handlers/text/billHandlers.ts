import { supabase } from '../../config/supabaseClient.js';
import { formatIDR } from '../../helpers/formatters.js';
import { sendTransactionEmailNotification } from '../../services/notificationService.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';

// 📌 FIX LOGIC JATUH TEMPO: Menghitung tanggal aktual tahun 2026 secara akurat
function dapatkanTanggalJatuhTempo(hariJatuhTempo: number): string {
    const hariIni = new Date(); // Hari ini: Rabu, 3 Juni 2026
    const tahunSekarang = hariIni.getFullYear();
    const bulanSekarang = hariIni.getMonth(); // Juni = indeks 5
    const tanggalSekarang = hariIni.getDate(); // Tanggal 3

    // Langkah 1: Buat target jatuh tempo di bulan berjalan (Juni 2026)
    let tanggalTarget = new Date(tahunSekarang, bulanSekarang, hariJatuhTempo);

    // Langkah 2: Jika tanggal sekarang (3) sudah MELEWATI hari jatuh tempo (misal due_date = 1),
    // maka tagihan tersebut dipindahkan ke bulan berikutnya (Juli 2026).
    // Tapi jika due_date = 5, karena sekarang tanggal 3, berarti tetap di bulan Juni 2026!
    if (tanggalSekarang > hariJatuhTempo) {
        tanggalTarget.setMonth(bulanSekarang + 1);
    }

    return tanggalTarget.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
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
            
            // 📌 FIX PARSING: Amankan ekstraksi nilai int4 dari row database Supabase
            const nilaiHari = b.due_date !== undefined && b.due_date !== null ? Number(b.due_date) : 1;
            const dueDate = dapatkanTanggalJatuhTempo(nilaiHari);
                
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
                const nilaiHari = b.due_date !== undefined && b.due_date !== null ? Number(b.due_date) : 1;
                const dueDate = dapatkanTanggalJatuhTempo(nilaiHari);
                listText += `${idx + 1}. *${b.name}* — ${formatIDR(Number(b.amount))} (Jatuh tempo: ${dueDate})\n`;
            });
            listText += '\nSilakan ketik lebih spesifik.\nContoh: `bayar wifi biznet`';
            return await ctx.replyWithMarkdown(listText);
        }

        const bill = bills[0];
        const amount = Number(bill.amount);
        const actor = ctx.state.actor || 'suami';
        const encodedName = encodeURIComponent(bill.name);
        
        // 📌 FIX PARSING: Samakan logika tanggal jatuh tempo pada menu konfirmasi pembayaran
        const nilaiHariBill = bill.due_date !== undefined && bill.due_date !== null ? Number(bill.due_date) : 1;
        const dueDate = dapatkanTanggalJatuhTempo(nilaiHariBill);

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
                const lowFundWarning = currentBalance < amount ? '⚠️ ' : '';
                
                if (currentBalance < amount) {
                    checkAndNotifyLowFund(ctx, p.display_name || p.name, currentBalance, actor)
                        .catch(err => console.error('❌ Gagal trigger alert low fund:', err));
                }

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

        sendTransactionEmailNotification({ 
            actor, 
            amount, 
            description: `Membuka Menu Bayar Tagihan: ${bill.name}`, 
            type: 'expense', 
            pocketName: 'System Check' 
        }).catch(err => console.error('❌ Notifikasi email gagal:', err));

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