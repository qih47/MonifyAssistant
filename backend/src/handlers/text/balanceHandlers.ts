import { supabase } from '../../config/supabaseClient.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { getPocketIcon } from '../../helpers/iconMapper.js';

export async function handleCekSaldo(ctx: any) {
    try {
        const { data: pockets, error } = await supabase
            .from('pockets')
            .select('name, current_balance, ownership');

        if (error) throw error;
        if (!pockets || pockets.length === 0) {
            return await ctx.reply('⚠️ Belum ada data kantong anggaran di database.');
        }

        let saldoBersama = 0, saldoQisthi = 0, saldoGita = 0;
        let detailBersama = '', detailQisthi = '', detailGita = '';

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
            '━━━━━━━━━━━━━━━━━━━\n💰 *LAPORAN SALDO REAL-TIME*\n━━━━━━━━━━━━━━━━━━━\n\n' +
            `🌐 *Kantong Bersama:* *${formatIDR(saldoBersama)}*\n` +
            `${detailBersama}` +
            `🧑 *Kantong Qisthi:* *${formatIDR(saldoQisthi)}*\n` +
            `${detailQisthi}` +
            `👩 *Kantong Gita:* *${formatIDR(saldoGita)}*\n` +
            `${detailGita}` +
            '━━━━━━━━━━━━━━━━━━━\n📊 *Total Aset Dana:* *' + formatIDR(totalSemua) + '*\n━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Data real-time';

        await ctx.replyWithMarkdown(reportText);
    } catch (err) {
        console.error('❌ Gagal load saldo:', err);
        await ctx.reply('⚠️ Gagal mengambil data saldo, Kak.');
    }
}
