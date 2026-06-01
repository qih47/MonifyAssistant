import { supabase } from '../config/supabaseClient.js';
import { getPocketIcon } from './iconMapper.js';
import { formatPocketName } from './formatters.js';
import { pendingTransactions } from '../state/pendingTransactions.js';

export async function getPocketButtons(txId: string): Promise<Array<Array<{ text: string; callback_data: string }>>> {
    try {
        const { data: pockets } = await supabase.from('pockets').select('id, name, display_name, ownership').order('name');
        const txData = pendingTransactions.get(txId);

        // Pilih callback prefix secara dinamis: 'sg' untuk saving goals, 'p' untuk transaksi normal
        const prefix = txData?.is_saving_goal ? 'sg' : 'p';

        if (!pockets || pockets.length === 0) {
            return [
                [{ text: '🌐 Operasional Utama', callback_data: `${prefix}:${txId}:1` }], // Default id 1
                [{ text: '❌ Batal', callback_data: `cancel:${txId}` }]
            ];
        }

        const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
        let currentRow: Array<{ text: string; callback_data: string }> = [];

        pockets.forEach((p, index) => {
            const icon = getPocketIcon(p.ownership, p.name);
            const cleanName = p.display_name || formatPocketName(p.name);
            // Use ID instead of Name in callback_data
            currentRow.push({ text: `${icon} ${cleanName}`, callback_data: `${prefix}:${txId}:${p.id}` });

            if (currentRow.length === 2 || index === pockets.length - 1) {
                buttons.push([...currentRow]);
                currentRow = [];
            }
        });

        buttons.push([{ text: '❌ Batal', callback_data: `cancel:${txId}` }]);
        return buttons;
    } catch (err) {
        console.error('❌ Gagal ambil pockets:', err);
        return [[{ text: '❌ Error', callback_data: `cancel:${txId}` }]];
    }
}
