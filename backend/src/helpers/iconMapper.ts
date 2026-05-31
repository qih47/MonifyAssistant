export function getPocketIcon(ownership: string, pocketName?: string): string {
    const ownerIconMap: Record<string, string> = {
        'bersama': '💳',
        'suami': '🧑',
        'istri': '👩',
    };

    const nameIconMap: Record<string, string> = {
        'operasional_utama': '🏦',
        'operasional_harian': '🛒',
        'jajan_qisthi': '🍜',
        'jajan_gita': '🧋',
        'transportasi_dan_kendaraan': '🏍️',
        'keperluan_bayi': '👶',
        'kebutuhan_rutin_bulanan': '📋',
        'tabungan_masa_depan': '💰',
    };

    if (pocketName && nameIconMap[pocketName]) {
        return nameIconMap[pocketName];
    }

    return ownerIconMap[ownership] || '💵';
}
