import { authMiddleware } from './middleware.js';
import { registerTextCommands } from './commands.js';
import { registerBotHandlers } from './handlers.js';
import { registerCallbackHandlers } from './callbacks.js';

export function initBot(bot: any, ALLOWED_CHAT_IDS: string[], ALLOWED_USERS: Record<string,string>) {
    bot.use(authMiddleware(ALLOWED_CHAT_IDS, ALLOWED_USERS));

    registerBotHandlers(bot);
    registerCallbackHandlers(bot);
    registerTextCommands(bot);
}
