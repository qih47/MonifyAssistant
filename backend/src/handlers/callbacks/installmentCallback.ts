/**
 * Installment Payment Callback Handler - payinstall: prefix
 * Handles installment payment confirmations
 */

import { supabase } from '../../config/supabaseClient.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';
import { sendTransactionEmailNotification } from '../../services/notificationService.js';
import { getPocketByName, updatePocketCurrentBalance } from '../../services/pocketService.js';
import { getAssetById, updateAssetBalance } from '../../services/assetService.js';
import { createTransaction } from '../../services/transactionService.js';

export async function handleInstallmentCallback(ctx: any, callbackData: string) {
    await ctx.answerCbQuery('⏳ Memproses...');
    const parts = callbackData.split(':');
    const amount = Number(parts[1]);
    const actor = parts[2];
    const selectedPocket = parts[3];
    const encodedName = parts[4];
    const installmentId = parts[5];
    const installmentName = decodeURIComponent(encodedName);

    try {
        const { data: inst } = await supabase
            .from('installments')
            .select('paid_months')
            .eq('id', installmentId)
            .single();
            
        if (!inst) { 
            await ctx.answerCbQuery('❌ Data tidak ditemukan.'); 
            return; 
        }
        
        const newPaidMonths = Number(inst.paid_months) + 1;
        await supabase.from('installments').update({ paid_months: newPaidMonths }).eq('id', installmentId);

        const pocketData = await getPocketByName(selectedPocket);
        const finalPocketId = pocketData?.id || 1;
        const linkedAssetId = pocketData?.asset_id;

        await createTransaction({
            amount,
            description: `Bayar cicilan: ${installmentName} (Bln ke-${newPaidMonths})`,
            type: 'expense',
            pocket_id: finalPocketId,
            asset_id: linkedAssetId || 1,
            actor,
            category: 'tagihan_rutin',
            merchant: installmentName,
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
            `━━━━━━━━━━━━━━━━━━━\n✅ *CICILAN DIBAYAR!*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `📝 ${installmentName}\n` +
            `💰 ${formatIDR(amount)}\n` +
            `📊 Bulan ke-${newPaidMonths}\n` +
            `📂 ${formatPocketName(selectedPocket)}\n` +
            `👤 ${actorEmoji}\n\n` +
            `🏠 Satu bulan lagi terbayar!`,
            { parse_mode: 'Markdown' }
        );
        
        sendTransactionEmailNotification({ 
            actor, 
            amount, 
            description: `Bayar cicilan: ${installmentName}`, 
            type: 'expense', 
            pocketName: selectedPocket 
        }).catch(() => { });
    } catch (error) {
        console.error('❌ Payinstall error:', error);
        await ctx.editMessageText('❌ Gagal bayar cicilan.').catch(() => { });
    }
}
