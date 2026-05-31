/**
 * Cancel Callback Handler - cancel: prefix
 * Handles transaction cancellation
 */

import { pendingTransactions } from '../../state/pendingTransactions.js';

export async function handleCancelCallback(ctx: any, callbackData: string) {
    const txId = callbackData.split(':')[1];
    pendingTransactions.delete(txId);
    
    await ctx.answerCbQuery('Dibatalkan.');
    await ctx.editMessageText('❌ Transaksi dibatalkan.').catch(() => { });
}

/**
 * Handle generic cancel buttons (cancel_bill, cancel_install)
 */
export async function handleGenericCancel(ctx: any, callbackData: string) {
    await ctx.answerCbQuery('Dibatalkan.');
    await ctx.editMessageText('❌ Dibatalkan.').catch(() => { });
}
