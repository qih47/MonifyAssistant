import { parseFinancialText } from '../../services/aiService.js';
import { parseTransactionManual } from '../../services/parsers.js';
import { getPocketButtons } from '../../helpers/buttons.js';
import { formatIDR } from '../../helpers/formatters.js';
import { generateNaturalResponse } from '../../helpers/naturalResponse.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';
import { isPotentialTransaction } from '../../helpers/validators.js';
import { analyzeReceiptType, mapReceiptTypeToSubtype } from '../../services/receiptAnalyzer.js';

export async function handleFinancialText(ctx: any, pesanAsli: string, userName: string) {
    if (!isPotentialTransaction(pesanAsli)) {
        return false;
    }

    await ctx.reply('⏳ Sebentar, Moni proses transaksinya...');
    let hasilParse = null;

    try {
        hasilParse = await parseFinancialText(pesanAsli);
    } catch (error) {
        // AI parsing gagal, lanjut ke fallback manual
    }

    if (!hasilParse) {
        const manualResult = parseTransactionManual(pesanAsli);
        if (manualResult) {
            hasilParse = manualResult as any;
        }
    }

    if (!hasilParse) {
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

    // Safety Fallback destructing agar tidak ada properti bernilai undefined
    const amount = hasilParse.amount || 0;
    const description = hasilParse.description || 'Transaksi';
    const type = hasilParse.type || 'expense';
    const aiActor = hasilParse.actor || 'auto';
    const category = hasilParse.category || 'lainnya';
    const merchant = hasilParse.merchant || 'umum';
    const transaction_date = hasilParse.transaction_date || new Date().toISOString();
    const is_saving_goal = !!hasilParse.is_saving_goal;
    const goal_name = hasilParse.goal_name || null;
    const transaction_subtype = hasilParse.transaction_subtype || null;

    // 📌 PERBAIKAN UTAMA: Amankan dari tebakan LLM, utamakan user yang chat di Telegram!
    const finalActor = ctx.state.actor || (aiActor !== 'auto' ? aiActor : 'suami');
    
    const txId = (is_saving_goal ? 'sg' : 'tx') + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const receiptAnalysis = analyzeReceiptType(description);
    const subtypeFromAnalyzer = mapReceiptTypeToSubtype(receiptAnalysis.type);
    const finalSubtype = transaction_subtype || (is_saving_goal ? 'saving_goal' : subtypeFromAnalyzer);

    // 📌 FIX DISINI: Ditambahkan "as any" untuk membungkus literal object agar TypeScript tidak protes
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
        goal_name,
        transaction_subtype: finalSubtype,
        receipt_type: receiptAnalysis.type
    } as any);

    const formattedAmount = formatIDR(amount);
    const actorEmojiPreview = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
    const keyboardButtons = await getPocketButtons(txId);

    // Safety handling untuk formatting tanggal terjemahan teks
    let dateText = '';
    try {
        const parsedDate = new Date(transaction_date);
        dateText = isNaN(parsedDate.getTime())
            ? new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            : parsedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        dateText = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    if (is_saving_goal && goal_name) {
        await ctx.reply(
            `━━━━━━━━━━━━━━━━━━━\n🎯 *KONFIRMASI TARGET TARGET TABUNGAN*\n━━━━━━━━━━━━━━━━━━━\n\n` +
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