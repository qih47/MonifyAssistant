export function authMiddleware(ALLOWED_CHAT_IDS: string[], ALLOWED_USERS: Record<string,string>) {
    return async (ctx: any, next: any) => {
        const chatId = (ctx.chat?.id || ctx.message?.chat.id || ctx.myChatMember?.chat.id)?.toString();
        const username = ctx.from?.username || 'Unknown';
        console.log(`📩 Update masuk | Chat ID: ${chatId} | Username: ${username} | Type: ${ctx.updateType}`);

        if (!chatId || !ALLOWED_CHAT_IDS.includes(chatId)) {
            if (ctx.updateType === 'message') {
                try {
                    await ctx.reply("🔒 Maaf, bot ini bersifat privat dan hanya bisa digunakan oleh pemilik.");
                } catch (err) {
                    console.log(`⚠️ Gagal kirim pesan blokir ke ${chatId}`);
                }
            }
            return;
        }

        const fromId = ctx.from?.id?.toString();
        let actor = 'suami';
        if (fromId && ALLOWED_USERS[fromId]) {
            actor = ALLOWED_USERS[fromId];
        } else if (chatId && ALLOWED_USERS[chatId]) {
            actor = ALLOWED_USERS[chatId];
        }
        ctx.state.actor = actor;

        if ((ctx.updateType === 'message' && ctx.message) || ctx.updateType === 'callback_query') {
            return next();
        }

        console.log(`ℹ️ Update tipe [${ctx.updateType}] diabaikan.`);
        return;
    };
}
