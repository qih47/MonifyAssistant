import { supabase } from '../../config/supabaseClient.js';
import { getPocketByName, updatePocketCurrentBalance } from '../../services/pocketService.js';
import { getAssetById, updateAssetBalance } from '../../services/assetService.js';
import { createTransaction } from '../../services/transactionService.js';
import { checkAndNotifyLowFund } from '../../services/lowFundService.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';

export async function handleSavingGoalCallback(ctx: any, callbackData: string) {
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
