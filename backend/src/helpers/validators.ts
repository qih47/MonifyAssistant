export function matchesAnyKeyword(text: string, keywords: string[]) {
    return keywords.some((keyword) => text.includes(keyword));
}

export function hasTransactionAmount(text: string) {
    return /\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i.test(text);
}

export function hasTransactionIntent(text: string) {
    return /beli|bayar|jajan|makan|minum|belanja|transfer|masuk|gaji|bonus|topup|isi|pulsa|servis|bensin|parkir|nabung|tabungan|tabung/i.test(text);
}

export function isPotentialTransaction(text: string) {
    return hasTransactionAmount(text) && hasTransactionIntent(text);
}
