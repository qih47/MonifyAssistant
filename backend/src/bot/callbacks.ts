import { handleCallbackQuery } from '../handlers/callbacks/callbackHandlers.js';

export function registerCallbackHandlers(bot: any) {
    bot.on('callback_query', handleCallbackQuery);
}
