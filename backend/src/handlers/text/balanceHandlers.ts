import { supabase } from '../../config/supabaseClient.js';
import { formatIDR, formatPocketName } from '../../helpers/formatters.js';
import { getPocketIcon } from '../../helpers/iconMapper.js';
import { queryWithAIContext } from '../../services/aiService.js';

export async function handleCekSaldo(ctx: any) {
    try {
        const userName = ctx.state.actor === 'suami' ? 'Qisthi' : 'Gita';

        // 1. Ambil Data Pockets dari Supabase
        const { data: pockets, error: pocketError } = await supabase
            .from('pockets')
            .select('name, current_balance, ownership, asset_id');
        if (pocketError) throw pocketError;

        // 2. Ambil Data Assets dari Supabase (dengan gold_weight_gram untuk emas)
        const { data: assets, error: assetError } = await supabase
            .from('assets')
            .select('name, balance, ownership, category, gold_weight_gram');
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
        let totalGoldWeight = 0;
        
        assets?.forEach(a => {
            const isGoldAsset = a.category?.includes('emas') || a.category?.includes('gold') || a.name.toLowerCase().includes('emas') || a.name.toLowerCase().includes('logam mulia');
            
            if (isGoldAsset && a.gold_weight_gram) {
                // Gold asset: display weight and calculate value (using standard buyback rate)
                totalGoldWeight += Number(a.gold_weight_gram || 0);
                const goldValue = Number(a.gold_weight_gram || 0) * 1450000; // Rp 1.450.000/gram
                totalAssetPhysical += goldValue;
                assetText += `   • ${a.name} (${a.ownership}): *${a.gold_weight_gram} gram* (≈ ${formatIDR(goldValue)})\n`;
            } else {
                // Regular monetary asset
                const bal = Number(a.balance || 0);
                totalAssetPhysical += bal;
                assetText += `   • ${a.name} (${a.ownership}): *${formatIDR(bal)}*\n`;
            }
        });

        const totalSemuaKantong = saldoBersama + saldoQisthi + saldoGita;

        // 3. Generate natural response with accurate DB context (prevents hallucination)
        const aiContextMessage = `${userName} meminta cek saldo. Total kantong: ${formatIDR(totalSemuaKantong)}, Total aset fisik: ${formatIDR(totalAssetPhysical)}${totalGoldWeight > 0 ? `, Emas: ${totalGoldWeight} gram` : ''}. Beri komentar singkat positif.`;
        const naturalReply = await queryWithAIContext(aiContextMessage, userName);
        
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
            `📊 *Total Aset Fisik:* *${formatIDR(totalAssetPhysical)}*\n` +
            `━━━━━━━━━━━━━━━━━━━\n🤖 Moni • Data akurat & real-time`;

        await ctx.replyWithMarkdown(reportText);
    } catch (err) {
        console.error("❌ Gagal load saldo gabungan:", err);
        await ctx.reply("⚠️ Gagal mengambil data saldo terintegrasi, Kak.");
    }
}