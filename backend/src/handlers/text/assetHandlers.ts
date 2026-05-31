import { supabase } from '../../config/supabaseClient.js';
import { formatIDR } from '../../helpers/formatters.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';

export async function handleTransferAsset(ctx: any, text: string) {
    try {
        const match = text.match(/(?:transfer\s+(?:ke|dari)\s+|pindah(?:in)?\s+(?:ke|dari)\s+|kirim\s+ke\s+|tf\s+ke\s+)(.+?)\s+(\d+[.,]?\d*)\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i);

        if (!match) {
            return ctx.reply('Format: `transfer ke [nama asset] [nominal]`\nContoh: `transfer ke mandiri istri 5jt`', { parse_mode: 'Markdown' });
        }

        const targetAssetName = match[1].trim();
        let amount = Number(match[2].replace(',', '.'));
        const unit = match[3]?.toLowerCase();
        if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount *= 1000;
        else if (unit === 'jt' || unit === 'juta') amount *= 1000000;

        const { data: targetAsset } = await supabase.from('assets').select('*').ilike('name', `%${targetAssetName}%`).single();
        if (!targetAsset) {
            return ctx.reply(`❌ Asset *"${targetAssetName}"* tidak ditemukan.`, { parse_mode: 'Markdown' });
        }

        const actor = ctx.state.actor;
        const { data: sourceAsset } = await supabase.from('assets').select('*').ilike('name', actor === 'suami' ? '%qisthi%' : '%gita%').eq('ownership', actor).single();
        if (!sourceAsset) return ctx.reply('❌ Asset sumber tidak ditemukan.');

        if (Number(sourceAsset.balance) < amount) {
            return ctx.reply(`❌ Saldo *${sourceAsset.name}* tidak cukup!\nSisa: *${formatIDR(Number(sourceAsset.balance))}*\nButuh: *${formatIDR(amount)}*`, { parse_mode: 'Markdown' });
        }

        const txId = 'tfa' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        pendingTransactions.set(txId, {
            amount, actor, description: `Transfer ke ${targetAsset.name}`, type: 'transfer',
            timestamp: Date.now(), category: 'transfer_antar_asset', merchant: targetAsset.name,
            transaction_date: new Date().toISOString()
        });

        await ctx.reply(
            '💸 *KONFIRMASI TRANSFER ASSET*\n\n' +
            `📤 Dari: *${sourceAsset.name}*\n📥 Ke: *${targetAsset.name}*\n💰 Nominal: *${formatIDR(amount)}*\n👤 Oleh: ${actor === 'suami' ? '🧑 Qisthi' : '👩 Gita'}\n\nLanjutkan?`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Ya, Transfer!', callback_data: `tfa:${txId}:${targetAsset.id}:${sourceAsset.id}` }],
                        [{ text: '❌ Batal', callback_data: `cancel:${txId}` }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error('❌ Gagal transfer asset:', err);
        await ctx.reply('⚠️ Error saat memproses transfer.');
    }
}
