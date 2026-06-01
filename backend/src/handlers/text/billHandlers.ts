import { supabase } from '../../config/supabaseClient.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { getPocketIcon } from '../../helpers/iconMapper.js';
import { sendTransactionEmailNotification } from '../../services/notificationService.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';

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
            const dueDate = b.due_date
                ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })
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
                const dueDate = b.due_date ? new Date(b.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '?';
                listText += `${idx + 1}. *${b.name}* — ${formatIDR(Number(b.amount))} (Jatuh tempo: ${dueDate})\n`;
            });
            listText += '\nSilakan ketik lebih spesifik.\nContoh: `bayar wifi biznet`';
            return await ctx.replyWithMarkdown(listText);
        }

        const bill = bills[0];
        const amount = Number(bill.amount);
        const actor = ctx.state.actor;
        const encodedName = encodeURIComponent(bill.name);
        const dueDate = bill.due_date ? new Date(bill.due_date * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : 'Tidak diketahui';

        const { data: pockets } = await supabase
            .from('pockets')
            .select('id, name, display_name, ownership')
            .order('name');

        const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
        if (pockets && pockets.length > 0) {
            let currentRow: Array<{ text: string; callback_data: string }> = [];
            pockets.forEach((p, index) => {
                const icon = getPocketIcon(p.ownership, p.name);
                const cleanName = p.display_name || formatPocketName(p.name);
                currentRow.push({
                    text: `${icon} ${cleanName}`,
                    callback_data: `paybill:${amount}:${actor}:${p.id}:${encodedName}:${bill.id}`
                });
                
                if (currentRow.length === 2 || index === pockets.length - 1) {
                    inline_keyboard.push([...currentRow]);
                    currentRow = [];
                }
            });
        } else {
            inline_keyboard.push([{ text: '🌐 Kantong Bersama', callback_data: `paybill:${amount}:${actor}:1:${encodedName}:${bill.id}` }]);
        }
        inline_keyboard.push([{ text: '❌ Batal', callback_data: 'cancel_bill' }]);

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
