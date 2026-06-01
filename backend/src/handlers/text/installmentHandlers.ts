import { supabase } from '../../config/supabaseClient.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { getPocketIcon } from '../../helpers/iconMapper.js';

export async function handleListCicilan(ctx: any) {
    try {
        const { data: installments, error } = await supabase
            .from('installments')
            .select('name, monthly_amount, paid_months, tenor_months, total_amount, down_payment')
            .order('name', { ascending: true });

        if (error) throw error;

        if (!installments || installments.length === 0) {
            return ctx.reply('✅ Tidak ada cicilan aktif, Kak! Keuangan aman terkendali.');
        }

        let listText = '━━━━━━━━━━━━━━━━━━━\n🏠 *DAFTAR CICILAN AKTIF*\n━━━━━━━━━━━━━━━━━━━\n\n';
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
            return ctx.reply('🎉 Semua cicilan sudah lunas, Kak! Tidak ada yang perlu dibayar.');
        }

        listText += `━━━━━━━━━━━━━━━━━━━\n⚠️ *Total Cicilan/Bulan: ${formatIDR(totalCicilanBulanan)}*\n\n`;
        listText += 'Ketik `cicil [nama cicilan]` untuk membayar.';

        await ctx.replyWithMarkdown(listText);
    } catch (err) {
        console.error('❌ Gagal list cicilan:', err);
        await ctx.reply('⚠️ Gagal mengambil data cicilan, Kak.');
    }
}

export async function handleBayarCicilan(ctx: any, namaCicilan: string) {
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
            listText += '\nSilakan ketik lebih spesifik.\nContoh: `cicil motor beat`';
            return await ctx.replyWithMarkdown(listText);
        }

        const installment = aktif[0];
        const amount = Number(installment.monthly_amount);
        const actor = ctx.state.actor;
        const encodedName = encodeURIComponent(installment.name);
        const progressPct = Math.round((Number(installment.paid_months) / Number(installment.tenor_months)) * 100);

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
                    callback_data: `payinstall:${amount}:${actor}:${p.id}:${encodedName}:${installment.id}`
                });
                
                if (currentRow.length === 2 || index === pockets.length - 1) {
                    inline_keyboard.push([...currentRow]);
                    currentRow = [];
                }
            });
        } else {
            inline_keyboard.push([{ text: '🌐 Kantong Bersama', callback_data: `payinstall:${amount}:${actor}:1:${encodedName}:${installment.id}` }]);
        }
        inline_keyboard.push([{ text: '❌ Batal', callback_data: 'cancel_install' }]);

        await ctx.reply(
            '━━━━━━━━━━━━━━━━━━━\n🏠 *KONFIRMASI BAYAR CICILAN*\n━━━━━━━━━━━━━━━━━━━\n\n' +
            `📝 *${installment.name}*\n` +
            `💰 Nominal Bulanan: *${formatIDR(amount)}*\n` +
            `📊 Progress: ${installment.paid_months}/${installment.tenor_months} bulan (${progressPct}%)\n` +
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
        console.error('❌ Gagal bayar cicilan:', err);
        await ctx.reply('⚠️ Error saat memproses pembayaran cicilan, Kak.');
    }
}
