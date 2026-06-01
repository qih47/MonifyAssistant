import { supabase } from '../../config/supabaseClient.js';
import { getPocketById, updatePocketCurrentBalance } from '../../services/pocketService.js';
import { getAssetById, updateAssetBalance } from '../../services/assetService.js';
import { createTransaction } from '../../services/transactionService.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';
import { sendTransactionEmailNotification } from '../../services/notificationService.js';
import { getPocketIcon } from '../../helpers/iconMapper.js';
import { formatPocketName, formatIDR } from '../../helpers/formatters.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';


export async function handleTransactionCallback(ctx: any, callbackData: string) {
    await ctx.answerCbQuery('⏳ Memproses...');
    const parts = callbackData.split(':');
    const txId = parts[1];
    const selectedPocketId = parts[2];

    const txData = pendingTransactions.get(txId) as any;
    if (!txData) { await ctx.answerCbQuery('❌ Data expired.'); return; }

    // CRITICAL FIX: Ensure actor is always valid before proceeding
    let { amount, actor, description, type, category, merchant, transaction_date } = txData;

    // Validate and fix actor if missing or invalid
    if (!actor || actor === 'auto' || (actor !== 'suami' && actor !== 'istri')) {
        actor = ctx.state.actor || 'suami'; // Fallback to session actor or default
        console.log(`⚠️ Fixed invalid actor '${txData.actor}' to '${actor}' for tx ${txId}`);
    }

    pendingTransactions.delete(txId);

    try {
        const pocketData = await getPocketById(Number(selectedPocketId));
        const finalPocketId = pocketData?.id || 1;
        const linkedAssetId = pocketData?.asset_id;
        const transactionType = type || 'expense';
        const modifier = transactionType === 'expense' ? -1 : 1;

        await createTransaction({
            amount,
            description,
            type: transactionType,
            pocket_id: finalPocketId,
            asset_id: linkedAssetId || 1,
            actor,
            category: category || 'lainnya',
            merchant: merchant || 'umum',
            created_at: transaction_date || new Date().toISOString()
        });

        let newPocketBalance = Number(pocketData?.current_balance || 0) + (amount * modifier);
        if (pocketData) {
            await updatePocketCurrentBalance(finalPocketId, newPocketBalance);
        }

        // CRITICAL: Synchronize physical asset balance (including gold weight handling)
        if (linkedAssetId) {
            const assetData = await getAssetById(linkedAssetId);
            if (assetData) {
                const isGoldAsset = assetData.category?.includes('emas') || assetData.category?.includes('gold') ||
                    assetData.name.toLowerCase().includes('emas') || assetData.name.toLowerCase().includes('logam mulia');

                if (isGoldAsset && assetData.gold_weight_gram) {
                    // For gold assets, adjust weight instead of balance
                    // Convert amount to grams (using Rp 1.450.000/gram buyback rate)
                    const amountInGrams = amount / 1450000;
                    const newGoldWeight = Number(assetData.gold_weight_gram) + (amountInGrams * modifier);
                    await supabase
                        .from('assets')
                        .update({ gold_weight_gram: newGoldWeight })
                        .eq('id', linkedAssetId);
                } else {
                    // Regular monetary asset: adjust balance
                    await updateAssetBalance(linkedAssetId, Number(assetData.balance) + (amount * modifier));
                }
            }
        }

        let matchedBillInfo = '';
        let matchedInstallmentInfo = '';

        // Auto-match bill if subtype is bill_payment
        if (txData.transaction_subtype === 'bill_payment' || txData.receipt_type === 'bill') {
            const entityName = extractEntityName(description, 'bill');
            if (entityName) {
                const { data: bills } = await supabase
                    .from('bills')
                    .select('*')
                    .eq('status', 'unpaid');

                if (bills && bills.length > 0) {
                    const matchedBill = bills.find(b => b.name.toLowerCase().includes(entityName.toLowerCase()));
                    if (matchedBill) {
                        await supabase
                            .from('bills')
                            .update({ status: 'paid', last_paid_at: new Date().toISOString() })
                            .eq('id', matchedBill.id);
                        matchedBillInfo = `\n🏢 *Tagihan Terkait:* ${matchedBill.name} (Lunas! 🎉)`;
                    }
                }
            }
        }

        // Auto-match installment if subtype is installment_payment
        if (txData.transaction_subtype === 'installment_payment' || txData.receipt_type === 'installment') {
            const entityName = extractEntityName(description, 'installment');
            if (entityName) {
                const { data: installments } = await supabase
                    .from('installments')
                    .select('*');

                if (installments && installments.length > 0) {
                    const activeInstallments = installments.filter(i => Number(i.tenor_months) > Number(i.paid_months));
                    const matchedInstallment = activeInstallments.find(i => i.name.toLowerCase().includes(entityName.toLowerCase()));
                    if (matchedInstallment) {
                        const newPaidMonths = Number(matchedInstallment.paid_months) + 1;
                        await supabase
                            .from('installments')
                            .update({ paid_months: newPaidMonths })
                            .eq('id', matchedInstallment.id);
                        matchedInstallmentInfo = `\n🏠 *Cicilan Terkait:* ${matchedInstallment.name} (Bulan ke-${newPaidMonths} Terbayar! 🎉)`;
                    }
                }
            }
        }

        await checkAndNotifyLowFund(ctx, pocketData?.name || 'kantong', newPocketBalance, actor);

        const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
        const pocketIcon = getPocketIcon(pocketData?.ownership || 'bersama', pocketData?.name);
        const cleanPocket = pocketData?.display_name || formatPocketName(pocketData?.name || 'Kantong');
        const dateText = new Date(transaction_date || new Date()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        await ctx.editMessageText(
            `━━━━━━━━━━━━━━━━━━━\n✅ *TRANSAKSI BERHASIL*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `📝 *${description}*\n` +
            `💰 Nominal: *${formatIDR(amount)}*\n` +
            `🏬 Toko: *${merchant || 'umum'}*\n` +
            `🏷️ Kategori: *${(category || 'lainnya').replace('_', ' ')}*\n` +
            `📅 Tanggal: *${dateText}*\n` +
            `🔄 Jenis: ${type === 'expense' ? '🔴 Pengeluaran' : type === 'income' ? '🟢 Pemasukan' : '🔵 Transfer'}\n` +
            `📂 Kantong: ${pocketIcon} ${cleanPocket}\n` +
            `👤 Eksekutor: ${actorEmoji}\n` +
            (matchedBillInfo || matchedInstallmentInfo || '') +
            `\n━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Tersimpan aman`,
            { parse_mode: 'Markdown' }
        );

        sendTransactionEmailNotification({ actor, amount, description, type: transactionType, pocketName: pocketData?.name || 'Kantong' })
            .catch(err => console.error('❌ Email gagal:', err));
    } catch (error) {
        console.error('❌ Callback error:', error);
        await ctx.editMessageText('❌ Gagal menyimpan, coba lagi.').catch(() => { });
    }
}

// Helper function extracted from receiptAnalyzer for standalone use
function extractEntityName(description: string, receiptType: string): string | null {
    const desc = description.toLowerCase();

    switch (receiptType) {
        case 'bill':
            const billMatch = desc.match(/(listrik|wifi|pln|internet|air|gas|token|kosan|kosan wifi)/i);
            return billMatch ? billMatch[1] : null;

        case 'installment':
            const instMatch = desc.match(/(?:cicil|bayar)\s+([a-zA-Z\s]+?)(?:\d+|$)/i);
            return instMatch ? instMatch[1].trim() : null;

        default:
            return null;
    }
}
