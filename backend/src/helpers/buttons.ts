import { supabase } from '../config/supabaseClient.js';
import { getPocketIcon } from './iconMapper.js';
import { formatPocketName, formatIDR } from './formatters.js'; // 📌 Pastikan formatIDR di-import dari helper lu
import { pendingTransactions } from '../state/pendingTransactions.js';

export async function getPocketButtons(txId: string): Promise<Array<Array<{ text: string; callback_data: string }>>> {
    try {
        // 📌 PERBAIKAN 1: Gunakan Join Query Supabase untuk menarik data asset induk (sumber dana) secara real-time
        const { data: pockets } = await supabase
            .from('pockets')
            .select(`
                id, 
                name, 
                display_name, 
                current_balance, 
                ownership,
                assets (
                    name
                )
            `)
            .order('name');
            
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
        
        // 📌 PERBAIKAN 2: Ubah layout menjadi 1 tombol per baris (Single Column Layout)
        // Karena teks sekarang panjang (ada nama kantong, saldo, dan jenis asset), 
        // layout 2 kolom akan membuat teks terpotong di layar HP. 1 Baris = 1 Kantong jauh lebih rapi!
        pockets.forEach((p) => {
            const icon = getPocketIcon(p.ownership, p.name);
            const cleanName = p.display_name || formatPocketName(p.name);
            const balanceText = formatIDR(Number(p.current_balance || 0));
            
            // Ambil nama asset induk hasil relasi foreign key database lu
            // @ts-ignore
            const assetName = p.assets?.name || 'Umum';

            // 📌 PERBAIKAN 3: Satukan informasi menjadi tombol multi-baris yang informatif
            // Format: 💳 Listrik Dan Pulsa (Rp 210.499) ➔ Sumber: LinkAja
            const buttonText = `${icon} ${cleanName} (${balanceText})\n↳ 🏦 Sumber: ${assetName}`;

            // Push langsung sebagai 1 baris mandiri
            buttons.push([{ text: buttonText, callback_data: `${prefix}:${txId}:${p.id}` }]);
        });

        buttons.push([{ text: '❌ Batal Transaksi', callback_data: `cancel:${txId}` }]);
        return buttons;
    } catch (err) {
        console.error('❌ Gagal ambil pockets dinamis:', err);
        return [[{ text: '❌ Error', callback_data: `cancel:${txId}` }]];
    }
}