/**
 * Input Validation Helpers
 * Validates user input for transactions, amounts, and other data
 */

/**
 * Validates if a string contains a valid amount format
 * Supports formats: 10000, 10rb, 10k, 10jt, 10juta, 10.5jt, etc.
 */
export function isValidAmount(input: string): boolean {
    const amountPattern = /\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i;
    return amountPattern.test(input);
}

/**
 * Extracts numeric amount from string and converts to number
 * @returns amount in base currency (IDR)
 */
export function parseAmount(input: string): number | null {
    const match = input.match(/(\d+[.,]?\d*)\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i);
    if (!match) return null;

    let amount = parseFloat(match[1].replace(',', '.'));
    const unit = (match[2] || '').toLowerCase();

    if (['rb', 'ribu', 'k'].includes(unit)) {
        amount *= 1000;
    } else if (['jt', 'juta', 'm', 'milyar', 'miliar'].includes(unit)) {
        amount *= 1000000;
    }

    return Math.round(amount);
}

/**
 * Validates pocket name input
 */
export function isValidPocketName(name: string): boolean {
    if (!name || name.trim().length === 0) return false;
    if (name.length > 50) return false;
    // Allow letters, numbers, spaces, and underscores
    return /^[a-zA-Z0-9_\s]+$/.test(name);
}

/**
 * Validates transaction description
 */
export function isValidDescription(desc: string): boolean {
    if (!desc || desc.trim().length === 0) return false;
    if (desc.length > 200) return false;
    return true;
}

/**
 * Checks if input contains transaction-related keywords
 */
export function isTransactionInput(input: string): boolean {
    const transactionKeywords = [
        'beli', 'bayar', 'jajan', 'makan', 'minum', 'belanja',
        'transfer', 'masuk', 'gaji', 'bonus', 'topup', 'isi',
        'pulsa', 'servis', 'bensin', 'parkir', 'nabung', 'tabungan', 'tabung'
    ];
    
    const lowerInput = input.toLowerCase();
    return transactionKeywords.some(keyword => lowerInput.includes(keyword));
}

/**
 * Validates date string (supports various Indonesian formats)
 */
export function isValidDate(dateStr: string): boolean {
    // Simple validation - can be enhanced based on needs
    const datePatterns = [
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // DD/MM/YYYY
        /^\d{1,2}-\d{1,2}-\d{2,4}$/,   // DD-MM-YYYY
        /^\d{4}-\d{2}-\d{2}$/           // YYYY-MM-DD
    ];
    
    return datePatterns.some(pattern => pattern.test(dateStr));
}

/**
 * Sanitizes user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/[<>]/g, '') // Remove HTML-like tags
        .trim()
        .substring(0, 500); // Limit length
}
