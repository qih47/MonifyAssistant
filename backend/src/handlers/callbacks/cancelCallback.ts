import { pendingTransactions } from '../../state/pendingTransactions.js';

export async function handleCancelCallback(ctx: any, callbackData: string) {
    if (callbackData.startsWith('cancel:')) {
        pendingTransactions.delete(callbackData.split(':')[1]);
        await ctx.answerCbQuery('Dibatalkan.');
        await ctx.editMessageText('❌ Transaksi dibatalkan.').catch(() => { });
        return;
    }

    if (callbackData === 'cancel_bill' || callbackData === 'cancel_install') {
        await ctx.answerCbQuery('Dibatalkan.');
        await ctx.editMessageText('❌ Pembayaran dibatalkan.').catch(() => { });
    }
}
