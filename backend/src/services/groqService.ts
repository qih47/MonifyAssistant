import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
    console.warn("⚠️ GROQ_API_KEY tidak ditemukan di .env!");
}

const client = new OpenAI({
    apiKey: apiKey || 'dummy',
    baseURL: 'https://api.groq.com/openai/v1',
});

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

export interface ParsedTransaction {
    amount: number;
    description: string;
    type: 'income' | 'expense' | 'transfer';
    allocated_pocket: string;
    actor: 'suami' | 'istri' | 'auto';
}

export async function parseFinancialTextWithGroq(text: string): Promise<ParsedTransaction | null> {
    if (!apiKey) return null;
    
    try {
        const response = await client.chat.completions.create({
            model: GROQ_MODEL,
            temperature: 0,
            messages: [
                {
                    role: 'system',
                    content: `Kamu adalah Moni, asisten keuangan keluarga Qisthi (suami) dan Gita (istri).
                    
Output HARUS JSON valid dengan format:
{
  "amount": integer (nominal dalam rupiah),
  "description": string (deskripsi singkat transaksi),
  "type": "income" | "expense" | "transfer",
  "allocated_pocket": string (snake_case: jajan_qisthi, jajan_gita, operasional_utama, transportasi_dan_kendaraan, keperluan_bayi, kebutuhan_rutin_bulanan, tabungan_masa_depan, operasional_harian, atau "ASK_USER" jika ambigu),
  "actor": "suami" | "istri" | "auto"
}

Aturan:
- amount: angka integer saja, tanpa titik/koma/Rp
- description: singkat, huruf kapital di awal
- type: income untuk uang masuk, expense untuk uang keluar, transfer untuk pindah saldo
- allocated_pocket: deteksi dari teks, ubah ke lowercase snake_case. "ASK_USER" jika tidak jelas
- actor: "istri" jika ada kata Gita/istri/bunda/mama, "suami" jika ada kata saya/aku/Qisthi/ayah, "auto" jika tidak jelas

JANGAN tambahkan teks apapun selain JSON.`
                },
                { role: 'user', content: text }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 200,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) return null;

        const parsed = JSON.parse(content);
        
        return {
            amount: parsed.amount || 0,
            description: parsed.description || 'Transaksi',
            type: ['income', 'expense', 'transfer'].includes(parsed.type) ? parsed.type : 'expense',
            allocated_pocket: parsed.allocated_pocket || 'ASK_USER',
            actor: ['suami', 'istri', 'auto'].includes(parsed.actor) ? parsed.actor : 'auto',
        };

    } catch (error: any) {
        console.error("❌ Groq error:", error?.message || error);
        return null;
    }
}