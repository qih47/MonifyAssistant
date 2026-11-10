import { getMemberByTelegramId, getSettings } from '../services/settingsService.js';

export function authMiddleware(ALLOWED_CHAT_IDS: string[], ALLOWED_USERS: Record<string,string>) {
    return async (ctx: any, next: any) => {
        const chatId = (ctx.chat?.id || ctx.message?.chat.id || ctx.myChatMember?.chat.id)?.toString();
        const fromId = ctx.from?.id?.toString();
        const username = ctx.from?.username || 'Unknown';
        console.log(`📩 Update masuk | Chat ID: ${chatId} | From ID: ${fromId} | Username: ${username} | Type: ${ctx.updateType}`);

        // Cek apakah diizinkan secara dinamis dari database/settings
        const dynamicMember = fromId ? await getMemberByTelegramId(fromId) : (chatId ? await getMemberByTelegramId(chatId) : null);
        const settings = await getSettings();
        const isDynamicAllowed = !!dynamicMember || 
            (settings.member_1.telegram_id && (settings.member_1.telegram_id === fromId || settings.member_1.telegram_id === chatId)) ||
            (settings.member_2.telegram_id && (settings.member_2.telegram_id === fromId || settings.member_2.telegram_id === chatId));

        const isAllowed = isDynamicAllowed || (chatId && ALLOWED_CHAT_IDS.includes(chatId));

        if (!chatId || !isAllowed) {
            if (ctx.updateType === 'message') {
                try {
                    await ctx.reply("🔒 Maaf, bot ini bersifat privat dan hanya bisa digunakan oleh akun keluarga terdaftar.");
                } catch (err) {
                    console.log(`⚠️ Gagal kirim pesan blokir ke ${chatId}`);
                }
            }
            return;
        }

        let actor = 'suami';
        let actorName = settings.member_1.name;

        if (dynamicMember) {
            actor = dynamicMember.actor;
            actorName = dynamicMember.name;
        } else if (fromId && ALLOWED_USERS[fromId]) {
            actor = ALLOWED_USERS[fromId];
            actorName = actor === 'suami' ? settings.member_1.name : settings.member_2.name;
        } else if (chatId && ALLOWED_USERS[chatId]) {
            actor = ALLOWED_USERS[chatId];
            actorName = actor === 'suami' ? settings.member_1.name : settings.member_2.name;
        }

        ctx.state.actor = actor;
        ctx.state.actorName = actorName;

        if ((ctx.updateType === 'message' && ctx.message) || ctx.updateType === 'callback_query') {
            return next();
        }

        console.log(`ℹ️ Update tipe [${ctx.updateType}] diabaikan.`);
        return;
    };
}
