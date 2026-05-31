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

        ctx.state.actor = ALLOWED_USERS[chatId as keyof typeof ALLOWED_USERS] || 'suami';

        if ((ctx.updateType === 'message' && ctx.message) || ctx.updateType === 'callback_query') {
            return next();
        }

        console.log(`ℹ️ Update tipe [${ctx.updateType}] diabaikan.`);
        return;
    };
}
