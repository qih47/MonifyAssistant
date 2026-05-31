import { supabase } from '../../config/supabaseClient.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { getPocketIcon } from '../../helpers/iconMapper.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';
import { sendTransactionEmailNotification } from '../../services/notificationService.js';
import { getPocketByName, updatePocketCurrentBalance } from '../../services/pocketService.js';
import { getAssetById, updateAssetBalance } from '../../services/assetService.js';
import { createTransaction } from '../../services/transactionService.js';

export async function handleCallbackQuery(ctx: any) {
    // @ts-ignore
    const callbackData = ctx.callbackQuery?.data;
    if (!callbackData) return;

    if (callbackData.startsWith('p:')) {
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
    else if (callbackData.startsWith('tfa:')) {
        await ctx.answerCbQuery('⏳ Memproses transfer...');
        const parts = callbackData.split(':');
        const txId = parts[1];
        const targetAssetId = Number(parts[2]);
        const sourceAssetId = Number(parts[3]);

        const txData = pendingTransactions.get(txId);
        if (!txData) { await ctx.answerCbQuery('❌ Data expired.'); return; }

        const { amount, actor } = txData;
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
    else if (callbackData.startsWith('sg:')) {
        await ctx.answerCbQuery('⏳ Memproses Tabungan...');
        const parts = callbackData.split(':');
        const txId = parts[1];
        const selectedPocket = parts[2];

        const txData = pendingTransactions.get(txId);
        if (!txData) { await ctx.answerCbQuery('❌ Data expired.'); return; }

        const { amount, actor, goal_name } = txData;
        pendingTransactions.delete(txId);

        try {
            const cleanedGoalName = goal_name ? goal_name.replace(/^(beli|buat|untuk|tabung|nabung)\s+/i, '').trim() : '';

            let { data: goal } = await supabase
                .from('saving_goals')
                .select('*')
                .ilike('name', cleanedGoalName)
                .eq('status', 'active')
                .maybeSingle();

            if (!goal) {
                const { data: newGoal, error: createGoalErr } = await supabase
                    .from('saving_goals')
                    .insert([{ name: goal_name, target_amount: 5000000, current_amount: 0, status: 'active' }])
                    .select()
                    .single();
                if (createGoalErr) throw createGoalErr;
                goal = newGoal;
            }

            const pocketData = await getPocketByName(selectedPocket);
            if (!pocketData) throw new Error('Kantong asal tidak valid.');

            const finalPocketId = pocketData.id;
            const linkedAssetId = pocketData.asset_id;

            const { error: logErr } = await supabase.from('saving_logs').insert([{
                goal_id: goal.id,
                amount,
                source_pocket_id: finalPocketId,
                actor
            }]);
            if (logErr) throw logErr;

            const newGoalAmount = Number(goal.current_amount || 0) + amount;
            const isAchieved = newGoalAmount >= Number(goal.target_amount);
            await supabase.from('saving_goals')
                .update({ current_amount: newGoalAmount, status: isAchieved ? 'achieved' : 'active' })
                .eq('id', goal.id);

            await updatePocketCurrentBalance(finalPocketId, Number(pocketData.current_balance) - amount);

            if (linkedAssetId) {
                const assetData = await getAssetById(linkedAssetId);
                if (assetData) {
                    await updateAssetBalance(linkedAssetId, Number(assetData.balance) - amount);
                }
            }

            const newPocketBalance = Number(pocketData.current_balance) - amount;
            await checkAndNotifyLowFund(ctx, selectedPocket, newPocketBalance, actor);

            await createTransaction({
                amount,
                description: `Setoran tabungan: ${goal.name}`,
                type: 'transfer',
                pocket_id: finalPocketId,
                asset_id: linkedAssetId || 1,
                category: 'investasi_tabungan',
                merchant: 'Moni Saving',
                actor,
                created_at: new Date().toISOString()
            });

            const progressPct = Math.min(Math.round((newGoalAmount / Number(goal.target_amount)) * 100), 100);
            const actorEmoji = actor === 'suami' ? '🧑 Qisthi' : '👩 Gita';

            await ctx.editMessageText(
                `━━━━━━━━━━━━━━━━━━━\n🎯 *SETORAN TABUNGAN SUKSES*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                `📦 Target: *${goal.name}*\n` +
                `💰 Nominal: *${formatIDR(amount)}*\n` +
                `📂 Sumber: *${formatPocketName(selectedPocket)}*\n` +
                `📊 Progress: *${formatIDR(newGoalAmount)}* / ${formatIDR(Number(goal.target_amount))} (*${progressPct}%*)\n` +
                `👤 Pengirim: ${actorEmoji}\n\n` +
                `${isAchieved ? '🎉 GOKIL LU CUY! Target tabungan ini sudah terpenuhi 100%. Siap dibeli! 🛍️' : '🚀 Semangat, kumpulkan terus jatah celengan lu berdua!'}`
            );
        } catch (err) {
            console.error('❌ Saving goal callback error:', err);
            await ctx.editMessageText('❌ Gagal memproses tabungan.').catch(() => { });
        }
    }
    else if (callbackData.startsWith('paybill:')) {
        await ctx.answerCbQuery('⏳ Memproses...');
        const parts = callbackData.split(':');
        const amount = Number(parts[1]);
        const actor = parts[2];
        const selectedPocket = parts[3];
        const encodedName = parts[4];
        const billId = parts[5];
        const billName = decodeURIComponent(encodedName);

        try {
            await supabase.from('bills').update({ status: 'paid', last_paid_at: new Date().toISOString() }).eq('id', billId);
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
                `━━━━━━━━━━━━━━━━━━━\n✅ *TAGIHAN LUNAS!*\n━━━━━━━━━━━━━━━━━━━\n\n📝 ${billName}\n💰 ${formatIDR(amount)}\n🏬 Merchant: *${billName}*\n🏷️ Kategori: *tagihan rutin*\n📂 ${formatPocketName(selectedPocket)}\n👤 ${actorEmoji}\n\n🎉 Tagihan berhasil dibayar!`,
                { parse_mode: 'Markdown' }
            );
            sendTransactionEmailNotification({ actor, amount, description: `Bayar tagihan: ${billName}`, type: 'expense', pocketName: selectedPocket }).catch(() => { });
        } catch (error) {
            console.error('❌ Paybill error:', error);
            await ctx.editMessageText('❌ Gagal bayar tagihan.').catch(() => { });
        }
    }
    else if (callbackData.startsWith('payinstall:')) {
        await ctx.answerCbQuery('⏳ Memproses...');
        const parts = callbackData.split(':');
        const amount = Number(parts[1]);
        const actor = parts[2];
        const selectedPocket = parts[3];
        const encodedName = parts[4];
        const installmentId = parts[5];
        const installmentName = decodeURIComponent(encodedName);

        try {
            const { data: inst } = await supabase.from('installments').select('paid_months').eq('id', installmentId).single();
            if (!inst) { await ctx.answerCbQuery('❌ Data tidak ditemukan.'); return; }
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
                `━━━━━━━━━━━━━━━━━━━\n✅ *CICILAN DIBAYAR!*\n━━━━━━━━━━━━━━━━━━━\n\n📝 ${installmentName}\n💰 ${formatIDR(amount)}\n📊 Bulan ke-${newPaidMonths}\n📂 ${formatPocketName(selectedPocket)}\n👤 ${actorEmoji}\n\n🏠 Satu bulan lagi terbayar!`,
                { parse_mode: 'Markdown' }
            );
            sendTransactionEmailNotification({ actor, amount, description: `Bayar cicilan: ${installmentName}`, type: 'expense', pocketName: selectedPocket }).catch(() => { });
        } catch (error) {
            console.error('❌ Payinstall error:', error);
            await ctx.editMessageText('❌ Gagal bayar cicilan.').catch(() => { });
        }
    }
    else if (callbackData.startsWith('cancel:')) {
        pendingTransactions.delete(callbackData.split(':')[1]);
        await ctx.answerCbQuery('Dibatalkan.');
        await ctx.editMessageText('❌ Transaksi dibatalkan.').catch(() => { });
    }
    else if (callbackData === 'cancel_bill' || callbackData === 'cancel_install') {
        await ctx.answerCbQuery('Dibatalkan.');
        await ctx.editMessageText('❌ Pembayaran dibatalkan.').catch(() => { });
    }
}
