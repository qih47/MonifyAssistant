import { sendTransactionEmailNotification } from './notificationService.js';
import { formatIDR, formatPocketName } from '../helpers/formatters.js';

export async function checkAndNotifyLowFund(ctx: any, pocketName: string, newBalance: number, actor: string): Promise<void> {
    try {
        const LOW_FUND_THRESHOLD = 2000000; // 2 juta
        const CRITICAL_THRESHOLD = 1000000; // 1 juta

        if (newBalance < CRITICAL_THRESHOLD) {
            const icon = "🔴 KRITIS!";
            const warningMsg = `${icon} Kantong *${formatPocketName(pocketName)}* SUDAH TINGGAL *${formatIDR(newBalance)}*!\n\n⚠️ BAHAYA OVERDRAFT! Jangan ada pengeluaran lagi sampai ada dana masuk!`;
            await ctx.replyWithMarkdown(warningMsg);

            await sendTransactionEmailNotification({
                actor,
                amount: newBalance,
                description: `⚠️ ALERT: Kantong ${formatPocketName(pocketName)} KRITIS (${formatIDR(newBalance)})`,
                type: 'alert',
                pocketName
            }).catch(() => { });
        } else if (newBalance < LOW_FUND_THRESHOLD) {
            const icon = "🟡 PERHATIAN";
            const warningMsg = `${icon} Kantong *${formatPocketName(pocketName)}* sudah kurang dari *2jt* → Sekarang *${formatIDR(newBalance)}*\n\n💡 Saran: Cek apakah perlu top-up dana dari assets lain.`;
            await ctx.replyWithMarkdown(warningMsg);
        }
    } catch (err) {
        console.error("❌ Error check low fund:", err);
    }
}
