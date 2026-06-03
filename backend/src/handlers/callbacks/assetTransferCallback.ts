import { getAssetById, updateAssetBalance } from '../../services/assetService.js';
import { createTransaction } from '../../services/transactionService.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';
import { formatIDR } from '../../helpers/formatters.js';

export async function handleAssetTransferCallback(ctx: any, callbackData: string) {
    await ctx.answerCbQuery('⏳ Memproses transfer...');
    const parts = callbackData.split(':');
    const txId = parts[1];
    const targetAssetId = Number(parts[2]);
    const sourceAssetId = Number(parts[3]);

    // 📌 PERBAIKAN 1: Tambahkan casting "as any" saat ambil data state agar lolos dari kompilasi strict tsc
    const txData = pendingTransactions.get(txId) as any;
    if (!txData) { await ctx.answerCbQuery('❌ Data expired.'); return; }

    let { amount, actor } = txData;
    
    // 📌 PERBAIKAN 2: Amankan validasi aktor dari middleware session Telegram seperti handler lainnya
    if (!actor || actor === 'auto' || (actor !== 'suami' && actor !== 'istri')) {
        actor = ctx.state.actor || 'suami';
    }
    
    pendingTransactions.delete(txId);

    try {
        const source = await getAssetById(sourceAssetId);
        const target = await getAssetById(targetAssetId);
        if (!source || !target) throw new Error('Asset tidak ditemukan');

        await updateAssetBalance(sourceAssetId, Number(source.balance) - amount);
        await updateAssetBalance(targetAssetId, Number(target.balance) + amount);

        await createTransaction({
            amount,
            description: `Transfer antar asset: ${source.name} → ${target.name}`,
            type: 'transfer',
            asset_id: sourceAssetId,
            actor,
            category: 'transfer_antar_asset',
            merchant: target.name,
            created_at: new Date().toISOString()
        });

        const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
        await ctx.editMessageText(
            `✅ *TRANSFER BERHASIL!*\n\n` +
            `📤 Dari: *${source.name}*\n📥 Ke: *${target.name}*\n💰 Nominal: *${formatIDR(amount)}*\n👤 Oleh: ${actorEmoji}\n\n` +
            `💵 Saldo ${source.name}: *${formatIDR(Number(source.balance) - amount)}*\n` +
            `💵 Saldo ${target.name}: *${formatIDR(Number(target.balance) + amount)}*`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('❌ Transfer error:', error);
        await ctx.editMessageText('❌ Gagal transfer asset.').catch(() => { });
    }
}