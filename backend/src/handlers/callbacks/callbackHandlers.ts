import { handleTransactionCallback } from './transactionCallback.js';
import { handleAssetTransferCallback } from './assetTransferCallback.js';
import { handleSavingGoalCallback } from './savingGoalCallback.js';
import { handleBillPaymentCallback } from './billPaymentCallback.js';
import { handleInstallmentCallback } from './installmentCallback.js';
import { handleCancelCallback } from './cancelCallback.js';

export async function handleCallbackQuery(ctx: any) {
    const callbackData = ctx.callbackQuery?.data;
    if (!callbackData) return;

    if (callbackData.startsWith('p:')) return await handleTransactionCallback(ctx, callbackData);
    if (callbackData.startsWith('tfa:')) return await handleAssetTransferCallback(ctx, callbackData);
    if (callbackData.startsWith('sg:')) return await handleSavingGoalCallback(ctx, callbackData);
    if (callbackData.startsWith('paybill:')) return await handleBillPaymentCallback(ctx, callbackData);
    if (callbackData.startsWith('payinstall:')) return await handleInstallmentCallback(ctx, callbackData);
    if (callbackData.startsWith('cancel:') || callbackData === 'cancel_bill' || callbackData === 'cancel_install') return await handleCancelCallback(ctx, callbackData);
}
