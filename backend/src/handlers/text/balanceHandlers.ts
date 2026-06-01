import { supabase } from '../../config/supabaseClient.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { getPocketIcon } from '../../helpers/iconMapper.js';
import { generateNaturalResponse } from '../../helpers/naturalResponse.js';

export async function handleCekSaldo(ctx: any) {
    try {
        const userName = ctx.state.actor === 'suami' ? 'Qisthi' : 'Gita';

        // 1. Ambil Data Pockets dari Supabase
        const { data: pockets, error: pocketError } = await supabase
            .from('pockets')
            .select('name, current_balance, ownership');
        if (pocketError) throw pocketError;

        // 2. Ambil Data Assets dari Supabase
        const { data: assets, error: assetError } = await supabase
            .from('assets')
            .select('name, balance, ownership');
        if (assetError) throw assetError;

        let saldoBersama = 0, saldoQisthi = 0, saldoGita = 0;
        let detailBersama = "";
        let detailQisthi = "";
        let detailGita = "";

        pockets?.forEach(p => {
            const balance = Number(p.current_balance || 0);
            const icon = getPocketIcon(p.ownership, p.name);
            const cleanName = formatPocketName(p.name);
            const line = `   ${icon} ${cleanName}: *${formatIDR(balance)}*\n`;

            if (p.ownership === 'bersama') { saldoBersama += balance; detailBersama += line; }
            else if (p.ownership === 'suami') { saldoQisthi += balance; detailQisthi += line; }
            else if (p.ownership === 'istri') { saldoGita += balance; detailGita += line; }
        });

        let assetText = "\n🏦 *ASET & REKENING FISIK:*\n";
        let totalAssetPhysical = 0;
        assets?.forEach(a => {
            const bal = Number(a.balance || 0);
            totalAssetPhysical += bal;
            assetText += `   • ${a.name} (${a.ownership}): *${formatIDR(bal)}*\n`;
        });

        const totalSemuaKantong = saldoBersama + saldoQisthi + saldoGita;

        // 3. Pancing AI dengan data database asli (Biar gak halu)
        const contextAkurat = `User bernama ${userName} meminta cek saldo. Laporkan bahwa total dana di kantong anggaran adalah ${formatIDR(totalSemuaKantong)} dan total uang fisik di bank/e-wallet adalah ${formatIDR(totalAssetPhysical)}. Beri komentar singkat yang positif.`;
        const naturalReply = await generateNaturalResponse(contextAkurat, userName);
        
        // 4. KIRIM SATU PER SATU SECARA BERURUTAN (AWAIT)
        await ctx.reply(naturalReply);

        const reportText =
            `━━━━━━━━━━━━━━━━━━━\n💰 *LAPORAN SALDO REAL-TIME*\n━━━━━━━━━━━━━━━━━━━\n\n` +
            `🌐 *Kantong Bersama:* *${formatIDR(saldoBersama)}*\n${detailBersama}` +
            `🧑 *Kantong Qisthi:* *${formatIDR(saldoQisthi)}*\n${detailQisthi}` +
            `👩 *Kantong Gita:* *${formatIDR(saldoGita)}*\n${detailGita}` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `${assetText}` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `📊 *Total Anggaran Kantong:* *${formatIDR(totalSemuaKantong)}*\n` +
            `📊 *Total Saldo Rekening Fisik:* *${formatIDR(totalAssetPhysical)}*\n` +
            `━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Data akurat & real-time`;

        await ctx.replyWithMarkdown(reportText);
    } catch (err) {
        console.error("❌ Gagal load saldo gabungan:", err);
        await ctx.reply("⚠️ Gagal mengambil data saldo terintegrasi, Kak.");
    }
}