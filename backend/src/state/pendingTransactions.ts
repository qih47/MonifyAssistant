export type PendingTx = {
    amount: number;
    actor: string;
    description: string;
    type: string;
    timestamp: number;
    category?: string;
    merchant?: string;
    transaction_date?: string;
    is_saving_goal?: boolean;
    goal_name?: string | null;
};

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
