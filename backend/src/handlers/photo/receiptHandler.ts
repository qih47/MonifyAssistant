import axios from 'axios';
import { parseFinancialImage } from '../../services/aiService.js';
import { formatIDR } from '../../helpers/formatters.js';
import { getPocketButtons } from '../../helpers/buttons.js';
import { pendingTransactions } from '../../state/pendingTransactions.js';

export async function handlePhotoMessage(ctx: any) {
    try {
        await ctx.reply('📸 Moni sedang membaca struk...');
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
        const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer', timeout: 10000 });
        const imageBuffer = Buffer.from(response.data);
        const hasilParse = await parseFinancialImage(imageBuffer, 'image/jpeg');

        if (hasilParse) {
            const { amount, description, type, actor: aiActor, category, merchant, transaction_date } = hasilParse;
            const finalActor = aiActor === 'auto' ? ctx.state.actor : aiActor;

            const txId = 'img' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
            pendingTransactions.set(txId, {
                amount, actor: finalActor, description, type, timestamp: Date.now(),
                category, merchant, transaction_date
            });

            const formattedAmount = formatIDR(amount);
            const actorEmojiPreview = finalActor === 'suami' ? '🧑 Qisthi' : '👩 Gita';
            const keyboardButtons = await getPocketButtons(txId);
            const dateText = new Date(transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            await ctx.reply(
                `━━━━━━━━━━━━━━━━━━━\n💳 *KONFIRMASI ALOKASI DANA (STRUK)*\n━━━━━━━━━━━━━━━━━━━\n\n` +
                `📝 *${description}*\n` +
                `💰 Nominal: *${formattedAmount}*\n` +
                `🏬 Toko: *${merchant}*\n` +
                `🏷️ Kategori: *${category.replace('_', ' ')}*\n` +
                `📅 Tanggal: *${dateText}*\n` +
                `🔴 Tipe: *Pengeluaran*\n` +
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
