/**
 * Transaction Handlers - Text Commands
 * Handles general transaction parsing and confirmation flow
 */

import { parseFinancialText } from '../../services/aiService.js';
import { parseTransactionManual } from '../../services/parsers.js';
import { formatIDR } from '../../helpers/formatters.js';
import { generateNaturalResponse } from '../../helpers/naturalResponse.js';
import { isValidAmount, isTransactionInput } from '../../helpers/validators.js';

/**
 * Handle general transaction input - parses and creates pending transaction
 */
export async function handleTransaction(ctx: any, pesanAsli: string) {
    const userName = ctx.state.actor === 'suami' ? 'Qisthi' : 'Gita';
    
    // Check if message contains amount or transaction keywords
    const punyaNominal = isValidAmount(pesanAsli);
    const transaksiKeywords = isTransactionInput(pesanAsli);
    
    const isKemungkinanTransaksi = punyaNominal || transaksiKeywords;
    
    if (!isKemungkinanTransaksi) {
        return false; // Not a transaction, let other handlers process it
    }

    await ctx.reply('⏳ Sebentar, Moni proses transaksinya...');
    let hasilParse = null;

    try { 
        hasilParse = await parseFinancialText(pesanAsli); 
    } catch (e) { 
        console.error('AI parse error:', e);
    }
    
    if (!hasilParse) {
        const manualResult = parseTransactionManual(pesanAsli);
        if (manualResult) {
            hasilParse = manualResult;
        }
    }

    if (hasilParse) {
        const { amount, description, type, actor: aiActor, category, merchant, transaction_date, is_saving_goal, goal_name } = hasilParse as any;
        const finalActor = aiActor === 'auto' ? ctx.state.actor : aiActor;
        
        // Import pendingTransactions dynamically
        const { pendingTransactions } = await import('../../state/pendingTransactions.js');
        
        const txId = (is_saving_goal ? 'sg' : 'tx') + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        pendingTransactions.set(txId, {
            amount, 
            actor: finalActor, 
            description, 
            type, 
            timestamp: Date.now(),
            category, 
            merchant, 
            transaction_date,
            is_saving_goal,
            goal_name
        });

        const formattedAmount = formatIDR(amount);
        const actorEmojiPreview = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
        
        // Get pocket buttons
        const { getPocketButtons } = await import('../../helpers/buttons.js');
        const keyboardButtons = await getPocketButtons(txId);
        const dateText = new Date(transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        if (is_saving_goal && goal_name) {
            await ctx.reply(
                `━━━━━━━━━━━━━━━━━━━\n🎯 *KONFIRMASI TARGET TABUNGAN*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                `📦 Impian: *${goal_name}*\n` +
                `💰 Setoran: *${formattedAmount}*\n` +
                `👤 Oleh: ${actorEmojiPreview}\n\n` +
                `Pilih kantong dana sumber setoran tabungan:`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboardButtons } }
            );
        } else {
            const tipeText = type === 'income' ? 'Pemasukan' : type === 'expense' ? 'Pengeluaran' : 'Transfer';
            const tipeEmoji = type === 'income' ? '🟢' : type === 'expense' ? '🔴' : '🔵';

            await ctx.reply(
                `━━━━━━━━━━━━━━━━━━━\n💳 *KONFIRMASI ALOKASI DANA*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                `📝 *${description}*\n` +
                `💰 Nominal: *${formattedAmount}*\n` +
                `🏬 Toko: *${merchant}*\n` +
                `🏷️ Kategori: *${category.replace('_', ' ')}*\n` +
                `📅 Tanggal: *${dateText}*\n` +
                `${tipeEmoji} Tipe: *${tipeText}*\n` +
                `👤 Oleh: ${actorEmojiPreview}\n\n` +
                `Pilih sumber dana:`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboardButtons } }
            );
        }
        return true;
    }

    // Failed to parse
    await ctx.reply(
        `━━━━━━━━━━━━━━━━━━━\n🤔 *Moni tidak mengerti*\n━━━━━━━━━━━━━━━━━━━\n\n` +
        `Tidak dapat menemukan nominal transaksi.\n\n` +
        `📝 *Format yang benar:*\n` +
        `• "Beli kopi 35rb"\n` +
        `• "Gaji masuk 5jt"\n` +
        `• "Nabung beli kulkas 700rb"\n\n` +
        `💡 Ketik *help* untuk bantuan.`,
        { parse_mode: 'Markdown' }
    );
    return true;
}

/**
 * Handle transfer between assets command
 */
export async function handleTransferCommand(ctx: any, pesanAsli: string) {
    const transferKeywords = ['transfer ke', 'transfer dari', 'pindahin ke', 'pindah ke', 'kirim ke', 'tf ke'];
    const hasTransferKeyword = transferKeywords.some(k => pesanAsli.toLowerCase().includes(k));
    const hasAmount = isValidAmount(pesanAsli);
    
    if (hasTransferKeyword && hasAmount) {
        const { handleTransferAsset } = await import('./assetHandlers.js');
        return await handleTransferAsset(ctx, pesanAsli);
    }
    
    return false;
}
