/**
 * Bot Handlers Registration
 * Registers text, photo, and callback handlers
 */

import { Telegraf } from 'telegraf';
import { handleTextMessage } from '../handlers/text/messageHandlers.js';
import { handlePhotoMessage } from '../handlers/photo/receiptHandler.js';
import { handleCallbackQuery } from '../handlers/callbacks/callbackHandlers.js';

export function registerHandlers(bot: Telegraf<any>) {
    // Text message handler - main dispatcher
    bot.on('text', handleTextMessage);
    
    // Photo message handler - OCR for receipts
    bot.on('photo', handlePhotoMessage);
    
    // Callback query handler - button interactions
    bot.on('callback_query', handleCallbackQuery);
}
