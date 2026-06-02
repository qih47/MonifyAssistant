export interface PendingTx {
    amount: number;
    actor: string;
    description: string;
    type: string;
    timestamp: number;
    category?: string;
    merchant?: string;
    transaction_date: string;
    is_saving_goal?: boolean;
    goal_name?: string | null;
    
    // 📌 DAFTARKAN DUA BARIS INI BIAR COMPILER TSC ADEM AYEM!
    transaction_subtype?: string;
    receipt_type?: string;
}

export const pendingTransactions = new Map<string, PendingTx>();

// Cleanup expired pending transactions (10 minutes lifetime)
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of pendingTransactions) {
        if (now - value.timestamp > 10 * 60 * 1000) {
            pendingTransactions.delete(key);
        }
    }
}, 60 * 1000);
