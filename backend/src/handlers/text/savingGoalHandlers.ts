import { supabase } from '../../config/supabaseClient.js';
import { formatIDR } from '../../helpers/formatters.js';

export async function handleSavingGoalOverview(ctx: any) {
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

        let reportText = `━━━━━━━━━━━━━━━━━━━\n🎯 *PROGRESS TARGET CELENGAN KELUARGA* \n━━━━━━━━━━━━━━━━━━━\n\n`;
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

        reportText += `━━━━━━━━━━━━━━━━━━━\n🚀 Semangat alokasikan sisa saldo kantong bulanan lu berdua!`;
        return await ctx.replyWithMarkdown(reportText);
    } catch (err) {
        console.error('❌ Gagal mengambil list tabungan via Telegram:', err);
        return await ctx.reply('⚠️ Waduh, Moni gagal menarik data tabungan. Sila cek koneksi database Supabase lu.');
    }
}
