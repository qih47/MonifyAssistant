import { supabase } from '../../config/supabaseClient.js';
import { getPocketById, updatePocketCurrentBalance } from '../../services/pocketService.js';
import { getAssetById, updateAssetBalance } from '../../services/assetService.js';
import { createTransaction } from '../../services/transactionService.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';
import { sendTransactionEmailNotification } from '../../services/notificationService.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';

export async function handleBillPaymentCallback(ctx: any, callbackData: string) {
    await ctx.answerCbQuery('⏳ Memproses...');
    const parts = callbackData.split(':');
    const amount = Number(parts[1]);
    const actor = parts[2];
    const selectedPocketId = parts[3];
    const encodedName = parts[4];
    const billId = parts[5];
    const billName = decodeURIComponent(encodedName);

    try {
        await supabase.from('bills').update({ status: 'paid', last_paid_at: new Date().toISOString() }).eq('id', billId);
        const pocketData = await getPocketById(Number(selectedPocketId));
        const finalPocketId = pocketData?.id || 1;
        const linkedAssetId = pocketData?.asset_id;

        await createTransaction({
            amount,
            description: `Bayar tagihan: ${billName}`,
            type: 'expense',
            pocket_id: finalPocketId,
            asset_id: linkedAssetId || 1,
            actor,
            category: 'tagihan_rutin',
            merchant: billName,
            created_at: new Date().toISOString()
        });

        const newPocketBalance = Number(pocketData?.current_balance || 0) - amount;
        if (pocketData) {
            await updatePocketCurrentBalance(finalPocketId, newPocketBalance);
        }

        if (linkedAssetId) {
            const assetData = await getAssetById(linkedAssetId);
            if (assetData) {
                await updateAssetBalance(linkedAssetId, Number(assetData.balance) - amount);
            }
        }

        const cleanPocket = pocketData?.display_name || formatPocketName(pocketData?.name || 'Kantong');

        await checkAndNotifyLowFund(ctx, pocketData?.name || 'kantong', newPocketBalance, actor);

        const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
        await ctx.editMessageText(
            `━━━━━━━━━━━━━━━━━━━\n✅ *TAGIHAN LUNAS!*\n━━━━━━━━━━━━━━━━━━━\n\n📝 ${billName}\n💰 ${formatIDR(amount)}\n🏬 Merchant: *${billName}*\n🏷️ Kategori: *tagihan rutin*\n📂 ${cleanPocket}\n👤 ${actorEmoji}\n\n🎉 Tagihan berhasil dibayar!`,
            { parse_mode: 'Markdown' }
        );
        sendTransactionEmailNotification({ actor, amount, description: `Bayar tagihan: ${billName}`, type: 'expense', pocketName: pocketData?.name || 'Kantong' }).catch(() => { });
    } catch (error) {
        console.error('❌ Paybill error:', error);
        await ctx.editMessageText('❌ Gagal bayar tagihan.').catch(() => { });
    }
}
