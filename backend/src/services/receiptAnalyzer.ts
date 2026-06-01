/**
 * Receipt Type Analyzer Service
 * Detects and classifies receipt types for intelligent transaction routing
 */

export type ReceiptType = 'purchase' | 'bill' | 'paylater' | 'installment' | 'transfer' | 'unknown';

export interface ReceiptAnalysis {
    type: ReceiptType;
    emoji: string;
    label: string;
    confidence: number; // 0-100
    reasoning?: string;
}

/**
 * Analyzes transaction description and detects receipt/transaction type
 * Used for both text and OCR-parsed descriptions
 */
export function analyzeReceiptType(description: string): ReceiptAnalysis {
    const desc = description.toLowerCase();
    
    // Bill Payment Detection
    if (/bayar listrik|bayar wifi|bayar token|bayar pln|bayar tagihan air|bayar gas|tagihan bulanan|invoice tagihan|bukti pembayaran listrik|tagihan wifi|struk wifi|nota wifi/i.test(desc)) {
        return {
            type: 'bill',
            emoji: '🏢',
            label: 'Pembayaran Tagihan',
            confidence: 95,
            reasoning: 'Detected bill payment keywords: listrik, wifi, tagihan, etc.'
        };
    }
    
    // Installment Payment Detection
    if (/bayar cicilan|cicilan|tenor|cicil motor|cicil mobil|pembayaran cicilan|angsuran|monthly payment|cicil motor yamaha|cicil mobil toyota/i.test(desc)) {
        return {
            type: 'installment',
            emoji: '🏍️',
            label: 'Pembayaran Cicilan',
            confidence: 95,
            reasoning: 'Detected installment keywords: cicilan, tenor, angsuran, etc.'
        };
    }
    
    // PayLater Payment Detection
    if (/bayar gcash|bayar paylater|paylater|kredivo|akulaku|shopee paylater|bayar utang|tagihan paylater|notifikasi pembayaran gcash|struk pembayaran kredivo|invoice akulaku/i.test(desc)) {
        return {
            type: 'paylater',
            emoji: '💳',
            label: 'Pembayaran PayLater',
            confidence: 90,
            reasoning: 'Detected paylater keywords: gcash, paylater, kredivo, akulaku, etc.'
        };
    }
    
    // Asset Transfer Detection
    if (/transfer|pindah.*ke|top-up|top up|transfer ke gopay|transfer ke mandiri|transfer ke bca|kirim ke rekening|bukti transfer|struk transfer/i.test(desc)) {
        return {
            type: 'transfer',
            emoji: '🔄',
            label: 'Transfer Antar Asset',
            confidence: 85,
            reasoning: 'Detected transfer keywords: transfer, pindah, top-up, etc.'
        };
    }
    
    // Purchase Detection (Default)
    if (/belanja|beli|pembelian|struk belanja|receipt|invoice|nota toko|bukti pembelian|alfamart|indomaret|tokopedia|shopee|blibli/i.test(desc)) {
        return {
            type: 'purchase',
            emoji: '🛍️',
            label: 'Pembelian',
            confidence: 85,
            reasoning: 'Detected purchase keywords: belanja, beli, struk, toko, etc.'
        };
    }
    
    // Unknown Type
    return {
        type: 'unknown',
        emoji: '❓',
        label: 'Transaksi Lainnya',
        confidence: 0,
        reasoning: 'Unable to determine receipt type from description'
    };
}

/**
 * Maps receipt type to transaction subtype (for consistency with AI parser)
 */
export function mapReceiptTypeToSubtype(receiptType: ReceiptType): string {
    const mapping: Record<ReceiptType, string> = {
        'bill': 'bill_payment',
        'installment': 'installment_payment',
        'paylater': 'paylater_payment',
        'purchase': 'purchase',
        'transfer': 'asset_transfer',
        'unknown': 'purchase' // default
    };
    return mapping[receiptType];
}

/**
 * Get colored emoji based on transaction type
 * Useful for UI display
 */
export function getReceiptTypeEmoji(receiptType: ReceiptType): string {
    const emojiMap: Record<ReceiptType, string> = {
        'bill': '🏢',
        'installment': '🏍️',
        'paylater': '💳',
        'purchase': '🛍️',
        'transfer': '🔄',
        'unknown': '❓'
    };
    return emojiMap[receiptType];
}

/**
 * Get user-friendly label for receipt type
 */
export function getReceiptTypeLabel(receiptType: ReceiptType): string {
    const labelMap: Record<ReceiptType, string> = {
        'bill': 'Pembayaran Tagihan',
        'installment': 'Pembayaran Cicilan',
        'paylater': 'Pembayaran PayLater',
        'purchase': 'Pembelian',
        'transfer': 'Transfer Antar Asset',
        'unknown': 'Transaksi Lainnya'
    };
    return labelMap[receiptType];
}

/**
 * Get confirmation message title based on receipt type
 */
export function getConfirmationTitle(receiptType: ReceiptType): string {
    const titleMap: Record<ReceiptType, string> = {
        'bill': '💳 KONFIRMASI PEMBAYARAN TAGIHAN',
        'installment': '🏍️ KONFIRMASI PEMBAYARAN CICILAN',
        'paylater': '💳 KONFIRMASI PEMBAYARAN PAYLATER',
        'purchase': '💳 KONFIRMASI ALOKASI DANA (STRUK)',
        'transfer': '🔄 KONFIRMASI TRANSFER ASSET',
        'unknown': '💳 KONFIRMASI ALOKASI DANA'
    };
    return titleMap[receiptType];
}

/**
 * Determine if receipt type needs special handling in UI
 */
export function needsSpecialRouting(receiptType: ReceiptType): boolean {
    return ['bill', 'installment', 'paylater', 'transfer'].includes(receiptType);
}

/**
 * Extract entity name from description for bill/installment matching
 * Example: "Bayar Listrik PLN 250rb" → "PLN"
 */
export function extractEntityName(description: string, receiptType: ReceiptType): string | null {
    const desc = description.toLowerCase();
    
    switch (receiptType) {
        case 'bill':
            const billMatch = desc.match(/(listrik|wifi|pln|internet|air|gas|token|kosan|kosan wifi)/i);
            return billMatch ? billMatch[1] : null;
            
        case 'installment':
            const instMatch = desc.match(/(?:cicil|bayar)\s+([a-zA-Z\s]+?)(?:\d+|$)/i);
            return instMatch ? instMatch[1].trim() : null;
            
        case 'paylater':
            const payMatch = desc.match(/(gcash|paylater|kredivo|akulaku|shopee paylater)/i);
            return payMatch ? payMatch[1] : null;
            
        case 'transfer':
            const xferMatch = desc.match(/(?:ke|to)\s+([a-zA-Z]+)/i);
            return xferMatch ? xferMatch[1] : null;
            
        default:
            return null;
    }
}

/**
 * Batch analyze multiple descriptions
 * Useful for processing lists of transactions
 */
export function analyzeMultipleReceipts(descriptions: string[]): ReceiptAnalysis[] {
    return descriptions.map(desc => analyzeReceiptType(desc));
}

/**
 * Get confidence score explanation
 */
export function explainConfidence(confidence: number): string {
    if (confidence >= 90) return 'Sangat yakin';
    if (confidence >= 75) return 'Yakin';
    if (confidence >= 50) return 'Cukup yakin';
    return 'Tidak yakin, mohon konfirmasi';
}
