import { handleTextMessage } from '../handlers/text/messageHandlers.js';
import { handlePhotoMessage } from '../handlers/photo/receiptHandler.js';

export function registerBotHandlers(bot: any) {
    bot.on('text', handleTextMessage);
    bot.on('photo', handlePhotoMessage);
}
