import { getPocketByName, updatePocketCurrentBalance } from '../../services/pocketService.js';
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
    const selectedPocket = parts[2];

    const txData = pendingTransactions.get(txId);
    if (!txData) { await ctx.answerCbQuery('❌ Data expired.'); return; }

    const { amount, actor, description, type, category, merchant, transaction_date } = txData;
    pendingTransactions.delete(txId);

    try {
        const pocketData = await getPocketByName(selectedPocket);
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

        if (linkedAssetId) {
            const assetData = await getAssetById(linkedAssetId);
            if (assetData) {
                await updateAssetBalance(linkedAssetId, Number(assetData.balance) + (amount * modifier));
            }
        }

        await checkAndNotifyLowFund(ctx, selectedPocket, newPocketBalance, actor);

        const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
        const pocketIcon = getPocketIcon(pocketData?.ownership || 'bersama');
        const cleanPocket = formatPocketName(selectedPocket);
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
            `\n━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Tersimpan aman`,
            { parse_mode: 'Markdown' }
        );

        sendTransactionEmailNotification({ actor, amount, description, type: transactionType, pocketName: selectedPocket })
            .catch(err => console.error('❌ Email gagal:', err));
    } catch (error) {
        console.error('❌ Callback error:', error);
        await ctx.editMessageText('❌ Gagal menyimpan, coba lagi.').catch(() => { });
    }
}
