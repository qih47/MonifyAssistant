import axios from 'axios';
import { parseFinancialImage } from '../../services/aiService.js';
import { formatIDR } from '../../helpers/formatters.js';
import { getPocketButtons } from '../../helpers/buttons.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';
import { 
    analyzeReceiptType, 
    getConfirmationTitle, 
    extractEntityName,
    mapReceiptTypeToSubtype 
} from '../../services/receiptAnalyzer.js';

export async function handlePhotoMessage(ctx: any) {
    try {
        await ctx.reply('📸 Moni sedang membaca struk...');
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
        const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer', timeout: 10000 });
        const imageBuffer = Buffer.from(response.data);
        const hasilParse = await parseFinancialImage(imageBuffer, 'image/jpeg');

        if (hasilParse) {
            const { amount, description, type, actor: aiActor, category, merchant, transaction_date, transaction_subtype } = hasilParse;

            // 📌 FIX UTAMA: Kunci aktor berdasarkan session pengirim chat Telegram dari Middleware!
            // Jangan biarkan tebakan LLM menimpa identitas asli pengguna yang sedang aktif chat.
            const finalActor = ctx.state.actor || (aiActor !== 'auto' ? aiActor : 'suami');

            const txId = 'img' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
            
            // Analyze receipt type for intelligent routing
            const receiptAnalysis = analyzeReceiptType(description);
            const subtypeFromAnalyzer = mapReceiptTypeToSubtype(receiptAnalysis.type);
            const finalSubtype = transaction_subtype || subtypeFromAnalyzer;
            
            // Simpan ke temporary state dengan menyertakan "as any" untuk menghindari strict type compile error
            pendingTransactions.set(txId, {
                amount, 
                actor: finalActor, 
                description, 
                type, 
                timestamp: Date.now(),
                category, 
                merchant, 
                transaction_date,
                receipt_type: receiptAnalysis.type,
                transaction_subtype: finalSubtype
            } as any);

            const formattedAmount = formatIDR(amount);
            
            // Konfigurasi visual avatar emoji berdasarkan aktor asli yang valid
            const actorEmojiPreview = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            const keyboardButtons = await getPocketButtons(txId);
            
            // Safety parsing tanggal dari LLM untuk menghindari crash Invalid Date
            let dateText = '';
            try {
                const parsedDate = new Date(transaction_date);
                dateText = isNaN(parsedDate.getTime())
                    ? new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : parsedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            } catch {
                dateText = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            }

            // Dynamic type display based on AI parsing
            const typeEmoji = type === 'income' ? '🟢' : type === 'transfer' ? '🔵' : '🔴';
            const typeLabel = type === 'income' ? 'Pemasukan' : type === 'transfer' ? 'Transfer' : 'Pengeluaran';

            // Use specialized confirmation title based on receipt type
            const confirmationTitle = getConfirmationTitle(receiptAnalysis.type);

            await ctx.reply(
                `━━━━━━━━━━━━━━━━━━━\n${confirmationTitle}\n━━━━━━━━━━━━━━━━━━━\n\n` +
                `📝 *${description}*\n` +
                `💰 Nominal: *${formattedAmount}*\n` +
                `🏬 Merchant: *${merchant || 'umum'}*\n` +
                `🏷️ Kategori: *${(category || 'lainnya').replace('_', ' ')}*\n` +
                `📅 Tanggal: *${dateText}*\n` +
                `${typeEmoji} Tipe: *${typeLabel}*\n` +
                `👤 Oleh: ${actorEmojiPreview}\n\n` +
                `Pilih sumber dana:`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboardButtons } }
            );
            return;
        }

        await ctx.reply(
            `━━━━━━━━━━━━━━━━━━━\n❌ *GAGAL MEMBACA STRUK*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `Moni tidak dapat membaca struk ini.\n\n` +
            `📝 *Alternatif:* Ketik manual\n` +
            `Contoh: "Belanja di Indomaret 85rb"`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('❌ Error foto:', error);
        await ctx.reply('❌ Gangguan teknis saat membaca struk.');
    }
}