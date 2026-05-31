/**
 * Saving Goal Handlers - Text Commands
 * Handles "nabung", "cek tabungan", and related commands
 */

import { supabase } from '../../config/supabaseClient.js';
import { formatIDR } from '../../helpers/formatters.js';
import { generateNaturalResponse } from '../../helpers/naturalResponse.js';

/**
 * Handle "cek tabungan" command - shows all active saving goals
 */
export async function handleCekTabungan(ctx: any) {
    await ctx.reply('🔍 Menarik data target celengan keluarga dari database...');

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

        let reportText = `━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 *PROGRESS TARGET CELENGAN KELUARGA* \n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
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

        reportText += `━━━━━━━━━━━━━━━━━━━━━━━━\n🚀 Semangat alokasikan sisa saldo kantong bulanan lu berdua!`;
        return await ctx.replyWithMarkdown(reportText);
    } catch (err) {
        console.error('❌ Gagal mengambil list tabungan via Telegram:', err);
        return await ctx.reply('⚠️ Waduh, Moni gagal menarik data tabungan. Sila cek koneksi database Supabase lu.');
    }
}

/**
 * Handle "nabung" command - parse and create pending saving transaction
 */
export async function handleNabung(ctx: any, pesanAsli: string) {
    const userName = ctx.state.actor === 'suami' ? 'Qisthi' : 'Gita';
    const pesan = pesanAsli.toLowerCase().trim();
    
    // Check for amount in the message
    const punyaNominal = /\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i.test(pesan);
    
    if (!punyaNominal) {
        return await ctx.reply(
            `━━━━━━━━━━━━━━━━━━━\n🤔 *Format Nabung Tidak Lengkap*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `Moni tidak menemukan nominal tabungan.\n\n` +
            `📝 *Format yang benar:*\n` +
            `• "Nabung beli kulkas 700rb"\n` +
            `• "Tabung untuk liburan 2jt"\n` +
            `• "Nabung Air Purifier 500rb"`,
            { parse_mode: 'Markdown' }
        );
    }

    // Extract goal name and amount (simplified parsing)
    const goalNameMatch = pesan.match(/(?:nabung|tabung|tabungan)\s+(?:beli|buat|untuk)?\s*(.+?)(?:\s+\d+)/i);
    const amountMatch = pesan.match(/(\d+[.,]?\d*)\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i);

    if (!goalNameMatch || !amountMatch) {
        return await ctx.reply('⚠️ Format nabung tidak dikenali. Contoh: "Nabung beli kulkas 700rb"');
    }

    const goalName = goalNameMatch[1].trim();
    let amount = parseFloat(amountMatch[1].replace(',', '.'));
    const unit = (amountMatch[2] || '').toLowerCase();

    if (['rb', 'ribu', 'k'].includes(unit)) {
        amount *= 1000;
    } else if (['jt', 'juta', 'm', 'milyar', 'miliar'].includes(unit)) {
        amount *= 1000000;
    }

    amount = Math.round(amount);

    const naturalReply = await generateNaturalResponse(`User "${userName}" ingin menabung: "${pesanAsli}".`, userName);
    await ctx.reply(naturalReply);

    // Create pending transaction for saving goal
    const txId = 'sg' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    
    // Import pendingTransactions dynamically to avoid circular dependency
    const { pendingTransactions } = await import('../../state/pendingTransactions.js');
    
    pendingTransactions.set(txId, {
        amount,
        actor: ctx.state.actor,
        description: `Setoran tabungan: ${goalName}`,
        type: 'transfer',
        timestamp: Date.now(),
        category: 'investasi_tabungan',
        merchant: 'Moni Saving',
        transaction_date: new Date().toISOString(),
        is_saving_goal: true,
        goal_name: goalName
    });

    // Get pocket buttons for confirmation
    const { getPocketButtons } = await import('../../helpers/buttons.js');
    const keyboardButtons = await getPocketButtons(txId);

    await ctx.reply(
        `━━━━━━━━━━━━━━━━━━━\n🎯 *KONFIRMASI TARGET TABUNGAN*\n━━━━━━━━━━━━━━━━━━━\n\n` +
        `📦 Impian: *${goalName}*\n` +
        `💰 Setoran: *${formatIDR(amount)}*\n` +
        `👤 Oleh: ${ctx.state.actor === 'suami' ? '🧑 Qisthi' : '👩 Gita'}\n\n` +
        `Pilih kantong dana sumber setoran tabungan:`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboardButtons } }
    );
}
