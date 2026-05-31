/**
 * Bill Payment Callback Handler - paybill: prefix
 * Handles bill payment confirmations
 */

import { supabase } from '../../config/supabaseClient.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';
import { sendTransactionEmailNotification } from '../../services/notificationService.js';
import { getPocketByName, updatePocketCurrentBalance } from '../../services/pocketService.js';
import { getAssetById, updateAssetBalance } from '../../services/assetService.js';
import { createTransaction } from '../../services/transactionService.js';

export async function handleBillPaymentCallback(ctx: any, callbackData: string) {
    await ctx.answerCbQuery('⏳ Memproses...');
    const parts = callbackData.split(':');
    const amount = Number(parts[1]);
    const actor = parts[2];
    const selectedPocket = parts[3];
    const encodedName = parts[4];
    const billId = parts[5];
    const billName = decodeURIComponent(encodedName);

    try {
        await supabase.from('bills').update({ 
            status: 'paid', 
            last_paid_at: new Date().toISOString() 
        }).eq('id', billId);
        
        const pocketData = await getPocketByName(selectedPocket);
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

        await checkAndNotifyLowFund(ctx, selectedPocket, newPocketBalance, actor);

        const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
        await ctx.editMessageText(
            `━━━━━━━━━━━━━━━━━━━\n✅ *TAGIHAN LUNAS!*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `📝 ${billName}\n` +
            `💰 ${formatIDR(amount)}\n` +
            `🏬 Merchant: *${billName}*\n` +
            `🏷️ Kategori: *tagihan rutin*\n` +
            `📂 ${formatPocketName(selectedPocket)}\n` +
            `👤 ${actorEmoji}\n\n` +
            `🎉 Tagihan berhasil dibayar!`,
            { parse_mode: 'Markdown' }
        );
        
        sendTransactionEmailNotification({ 
            actor, 
            amount, 
            description: `Bayar tagihan: ${billName}`, 
            type: 'expense', 
            pocketName: selectedPocket 
        }).catch(() => { });
    } catch (error) {
        console.error('❌ Paybill error:', error);
        await ctx.editMessageText('❌ Gagal bayar tagihan.').catch(() => { });
    }
}
