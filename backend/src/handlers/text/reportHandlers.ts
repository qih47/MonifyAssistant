import { supabase } from '../../config/supabaseClient.js';
import { Readable } from 'stream';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { generateNaturalResponse } from '../../helpers/naturalResponse.js';

export async function handleRingkasan(ctx: any) {
    try {
        await ctx.reply('📊 Menyusun ringkasan keuangan bulan ini...');

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

        let tagihanText = '', totalTagihan = 0;
        if (bills && bills.length > 0) {
            bills.forEach(b => {
                totalTagihan += Number(b.amount);
                const dueDate = b.due_date ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '?';
                tagihanText += `• ${b.name}: ${formatIDR(Number(b.amount))} (Jatuh tempo: ${dueDate})\n`;
            });
        } else {
            tagihanText = '✅ Tidak ada tagihan pending\n';
        }

        const { data: installments } = await supabase
            .from('installments')
            .select('name, monthly_amount, paid_months, tenor_months, total_amount, down_payment');

        let cicilanText = '', totalCicilanBulanan = 0;
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
            cicilanText = '✅ Tidak ada cicilan kredit\n';
        }

        const { data: pockets } = await supabase.from('pockets').select('name, current_balance');
        let totalSaldo = 0;
        pockets?.forEach(p => { totalSaldo += Number(p.current_balance || 0); });

        const totalKewajiban = totalTagihan + totalCicilanBulanan;
        const sisaSetelahBayar = totalSaldo - totalKewajiban;

        const ringkasan =
            '━━━━━━━━━━━━━━━━━━━\n📊 *RINGKASAN KEUANGAN*\n' + bulanTeks + '\n━━━━━━━━━━━━━━━━━━━\n\n' +
            '💰 *ARUS KAS:*\n' +
            `🟢 Pemasukan: *${formatIDR(totalPemasukan)}*\n` +
            `🔴 Pengeluaran: *${formatIDR(totalPengeluaran)}*\n` +
            `📈 Selisih: *${formatIDR(totalPemasukan - totalPengeluaran)}*\n` +
            `📝 Total Transaksi: ${totalTransaksi}\n\n` +
            '👤 *PENGELUARAN:*\n' +
            `🧑 Qisthi: *${formatIDR(pengeluaranQisthi)}*\n` +
            `👩 Gita: *${formatIDR(pengeluaranGita)}*\n` +
            `🌐 Bersama: *${formatIDR(pengeluaranBersama)}*\n\n` +
            `💼 *SALDO SAAT INI:* *${formatIDR(totalSaldo)}*\n\n` +
            '📋 *TAGIHAN PENDING:*\n' +
            `${tagihanText}\n` +
            '🏠 *CICILAN AKTIF:*\n' +
            `${cicilanText}\n` +
            `⚠️ *TOTAL KEWAJIBAN:* *${formatIDR(totalKewajiban)}*\n` +
            `💰 *SISA SETELAH BAYAR:* *${formatIDR(sisaSetelahBayar)}*\n` +
            (sisaSetelahBayar < 0 ? '⚠️ PERHATIAN: Saldo tidak cukup!' : '✅ Saldo cukup untuk semua kewajiban.') +
            '\n━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Ringkasan real-time';

        await ctx.replyWithMarkdown(ringkasan);
    } catch (err) {
        console.error('❌ Gagal ringkasan:', err);
        await ctx.reply('⚠️ Gagal menyusun ringkasan, Kak.');
    }
}

export async function handleLaporan(ctx: any) {
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
            return await ctx.reply('ℹ️ Belum ada transaksi untuk bulan ini, Kak.');
        }

        let csvContent = 'Tanggal;Deskripsi;Nominal;Tipe;Kantong;Eksekutor\n';
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
            caption: '━━━━━━━━━━━━━━━━━━━\n📊 *LAPORAN KEUANGAN*\n' + sekarang.toLocaleString('id-ID', { month: 'long', year: 'numeric' }) + '\n━━━━━━━━━━━━━━━━━━━\n\nFile CSV siap dibuka di Excel. 🚀'
        });

    } catch (err) {
        console.error('❌ Gagal membuat laporan:', err);
        await ctx.reply('⚠️ Error saat generate laporan, Kak.');
    }
}
