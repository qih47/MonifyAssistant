import { authMiddleware } from './middleware.js';
import { registerTextCommands } from '../handlers/text/commandHandlers.js';
import { handleTextMessage } from '../handlers/text/messageHandlers.js';
import { handleCallbackQuery } from '../handlers/callbacks/callbackHandlers.js';
import { handlePhotoMessage } from '../handlers/photoHandlers.js';

export function initBot(bot: any, ALLOWED_CHAT_IDS: string[], ALLOWED_USERS: Record<string,string>) {
    bot.use(authMiddleware(ALLOWED_CHAT_IDS, ALLOWED_USERS));

    // Handlers
    bot.on('text', handleTextMessage);
    bot.on('callback_query', handleCallbackQuery);
    bot.on('photo', handlePhotoMessage);

    // Commands
    registerTextCommands(bot);
}
