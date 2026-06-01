export function parseTransactionManual(text: string): { 
    amount: number; 
    description: string; 
    type: string; 
    transaction_subtype: 'purchase' | 'bill_payment' | 'installment_payment' | 'paylater_payment' | 'saving_goal' | 'asset_transfer';
    allocated_pocket: string; 
    actor: string; 
    category: string; 
    merchant: string; 
    transaction_date: string; 
    is_saving_goal: boolean; 
    goal_name: string | null;
    bill_name?: string;
    installment_name?: string;
} | null {
    const pesan = text.toLowerCase().trim();
    const nominalMatch = pesan.match(/(\d+[.,]?\d*)\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/i);
    if (!nominalMatch) return null;

    let amount = Number(nominalMatch[1].replace(',', '.'));
    const unit = nominalMatch[2]?.toLowerCase();
    if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount *= 1000;
    else if (unit === 'jt' || unit === 'juta') amount *= 1000000;
    else if (unit === 'milyar' || unit === 'miliar' || unit === 'm') amount *= 1000000000;
    if (amount <= 0 || amount > 100000000000) return null;

    let type = 'expense';
    if (/gaji|masuk|income|bonus|dapet|terima|transfer masuk/i.test(pesan)) type = 'income';
    else if (/transfer|pindah|nabung/i.test(pesan)) type = 'transfer';

    let actor = 'auto';
    if (/gita|istri|bunda|mama/i.test(pesan)) actor = 'istri';
    else if (/\bsaya\b|\baku\b|qisthi|ayah|papa/i.test(pesan)) actor = 'suami';

    // NEW: Detect transaction_subtype
    let transaction_subtype: 'purchase' | 'bill_payment' | 'installment_payment' | 'paylater_payment' | 'saving_goal' | 'asset_transfer' = 'purchase';
    let bill_name: string | undefined;
    let installment_name: string | undefined;

    if (/bayar listrik|bayar wifi|bayar token|bayar pln|bayar tagihan air|bayar gas|tagihan bulanan/i.test(pesan)) {
        transaction_subtype = 'bill_payment';
        const billMatch = pesan.match(/(listrik|wifi|token|pln|air|gas|internet)/i);
        if (billMatch) bill_name = billMatch[1].charAt(0).toUpperCase() + billMatch[1].slice(1);
    } else if (/bayar cicilan|cicilan|tenor|cicil motor|cicil mobil/i.test(pesan)) {
        transaction_subtype = 'installment_payment';
        const instMatch = pesan.match(/cicil\s+([a-zA-Z\s]+)/i);
        if (instMatch) installment_name = instMatch[1].split(/\d+/)[0].trim();
    } else if (/bayar gcash|bayar paylater|paylater|kredivo|akulaku|shopee paylater/i.test(pesan)) {
        transaction_subtype = 'paylater_payment';
    } else if (/transfer|pindah.*ke|top-up/i.test(pesan)) {
        transaction_subtype = 'asset_transfer';
    } else if (/nabung|tabung|celengan|beli.*impian|untuk.*impian/i.test(pesan)) {
        transaction_subtype = 'saving_goal';
    }

    let allocated_pocket = 'ASK_USER';
    if (/jajan qisthi|jajan ku|jajan saya/i.test(pesan)) allocated_pocket = 'jajan_qisthi';
    else if (/jajan gita|jajan istri/i.test(pesan)) allocated_pocket = 'jajan_gita';
    else if (/operasional/i.test(pesan)) allocated_pocket = 'operasional_utama';
    else if (/transportasi|bensin|motor|servis|parkir/i.test(pesan)) allocated_pocket = 'transportasi_dan_kendaraan';
    else if (/bayi|popok|susu|anak/i.test(pesan)) allocated_pocket = 'keperluan_bayi';
    else if (/wifi|listrik|tagihan|pln/i.test(pesan)) allocated_pocket = 'kebutuhan_rutin_bulanan';
    else if (/tabungan|investasi|emas|nabung|tabung/i.test(pesan)) allocated_pocket = 'tabungan_masa_depan';
    else if (/jajan|makan|kopi|cemilan/i.test(pesan)) allocated_pocket = 'operasional_harian';

    const cleanDesc = text.replace(/rp\.?\s*/gi, '').replace(/\d+[.,]?\d*\s*(rb|ribu|k|jt|juta|m|milyar|miliar)?/gi, '').replace(/pake\s+.*/gi, '').replace(/dari\s+.*/gi, '').replace(/masuk\s+ke\s+.*/gi, '').trim();
    const description = cleanDesc || text.replace(/\d.*/, '').trim() || 'Transaksi';

    // Fallback Manual granular
    let category = 'lainnya';
    if (/makan|martabak|kopi|sugu/i.test(pesan)) category = 'makanan_minuman';
    else if (/laptop|hp|listrik|wifi/i.test(pesan)) category = 'elektronik';

    let merchant = 'umum';
    const storeMatch = pesan.match(/di\s+([a-zA-Z0-9_\s]+)/i);
    if (storeMatch) merchant = storeMatch[1].trim();

    const is_saving_goal = /nabung|tabungan|tabung/i.test(pesan) && !/masa depan/i.test(pesan); // Tambah kata 'tabung'
    let goal_name = null;
    if (is_saving_goal) {
        const goalMatch = text.match(/(?:beli|buat|tabung|nabung)\s+([a-zA-Z0-9_\s]+)/i);
        if (goalMatch) {
            goal_name = goalMatch[1]
                .replace(/\d.*/, '')
                .replace(/^(beli|buat|tabung|nabung)\s+/i, '')
                .trim();
        }
    }

    const result: any = {
        amount: Math.round(amount),
        description: description.replace(/^[.,\s]+/, '').trim() || 'Transaksi',
        type,
        transaction_subtype,
        allocated_pocket,
        actor,
        category,
        merchant,
        transaction_date: new Date().toISOString(),
        is_saving_goal,
        goal_name
    };

    if (bill_name) result.bill_name = bill_name;
    if (installment_name) result.installment_name = installment_name;

    return result;
}
