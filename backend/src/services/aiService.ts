import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// KONFIGURASI
// ==========================================
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

// Inisialisasi AI clients
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const groqClient = GROQ_API_KEY ? new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
}) : null;

// ==========================================
// INTERFACE
// ==========================================
export interface ParsedTransaction {
    amount: number;
    description: string;
    type: 'income' | 'expense' | 'transfer';
    allocated_pocket: string;
    actor: 'suami' | 'istri' | 'auto';
}

// ==========================================
// TRACKER AI MANA YANG SEDANG DIGUNAKAN
// ==========================================
let groqAvailable = GROQ_API_KEY ? true : false;
let geminiAvailable = GEMINI_API_KEY ? true : false;

// ==========================================
// PARSER GROQ
// ==========================================
async function parseWithGroq(text: string): Promise<ParsedTransaction | null> {
    if (!groqClient || !GROQ_API_KEY) return null;

    try {
        const response = await groqClient.chat.completions.create({
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
- amount: angka integer saja, tanpa titik/koma/Rp. Contoh: 50000
- description: singkat, huruf kapital di awal. Contoh: "Beli Bakso Cuanki"
- type: "income" untuk uang masuk (gaji, bonus), "expense" untuk uang keluar (beli, bayar), "transfer" untuk pindah saldo
- allocated_pocket: deteksi dari teks, ubah ke lowercase snake_case. Contoh: "Jajan Qisthi" -> "jajan_qisthi". "ASK_USER" jika tidak jelas.
- actor: "istri" jika ada kata Gita/istri/bunda/mama, "suami" jika ada kata saya/aku/Qisthi/ayah, "auto" jika tidak jelas
- Prediksi kantong jika tidak disebutkan:
  * bensin, servis, parkir -> "transportasi_dan_kendaraan"
  * wifi, listrik, tagihan -> "kebutuhan_rutin_bulanan"
  * bayi, popok, susu -> "keperluan_bayi"
  * jajan, makan, kopi -> "operasional_harian"

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
        console.error('❌ Groq error:', error?.message || error);
        if (error?.status === 429) {
            groqAvailable = false;
            console.log('⚠️ Groq rate limited, switch ke Gemini...');
        }
        return null;
    }
}

// ==========================================
// PARSER GEMINI
// ==========================================
async function parseWithGemini(text: string): Promise<ParsedTransaction | null> {
    if (!genAI || !GEMINI_API_KEY) return null;

    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: "OBJECT" as any,
                    properties: {
                        amount: { type: "INTEGER" as any },
                        description: { type: "STRING" as any },
                        type: { type: "STRING" as any, enum: ['income', 'expense', 'transfer'] },
                        allocated_pocket: { type: "STRING" as any },
                        actor: { type: "STRING" as any, enum: ['suami', 'istri', 'auto'] }
                    },
                    required: ["amount", "description", "type", "allocated_pocket", "actor"]
                } as any
            }
        });

        const prompt = `
Parse teks transaksi keuangan ini ke JSON:
"${text}"

Aturan:
- type: "income" (uang masuk), "expense" (uang keluar), "transfer" (pindah saldo)
- allocated_pocket: snake_case (contoh: jajan_qisthi, operasional_utama) atau "ASK_USER"
- actor: "suami" (Qisthi/saya), "istri" (Gita), "auto" (tidak jelas)
- JANGAN tambahkan teks selain JSON.
        `;

        const result = await model.generateContent(prompt);
        const jsonText = result.response.text();
        if (!jsonText) return null;

        const clean = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(clean) as ParsedTransaction;

    } catch (error: any) {
        console.error('❌ Gemini error:', error?.message || error);
        if (error?.status === 429) {
            geminiAvailable = false;
            console.log('⚠️ Gemini rate limited, switch ke Groq...');
        }
        return null;
    }
}

// ====================================================
// PARSER UTAMA: AUTO-SWITCH GROQ <-> GEMINI
// ====================================================
export async function parseFinancialText(text: string): Promise<ParsedTransaction | null> {
    console.log(`🔍 Parsing: "${text.substring(0, 50)}..."`);

    // 1. Coba Groq dulu (gratis, rate limit generous: 30 req/menit, 14.400 req/hari)
    if (groqAvailable) {
        console.log('🟢 Mencoba Groq...');
        const result = await parseWithGroq(text);
        if (result && result.amount > 0) {
            console.log('✅ Groq berhasil!');
            groqAvailable = true; // Reset flag
            return result;
        }
        console.log('⚠️ Groq gagal, switch ke Gemini...');
    }

    // 2. Fallback ke Gemini (20 req/hari free tier)
    if (geminiAvailable) {
        console.log('🔵 Mencoba Gemini...');
        const result = await parseWithGemini(text);
        if (result && result.amount > 0) {
            console.log('✅ Gemini berhasil!');
            geminiAvailable = true; // Reset flag
            return result;
        }
        console.log('⚠️ Gemini gagal...');
    }

    // 3. Coba balik ke Groq (kalau tadi di-skip karena flag false)
    if (!groqAvailable && groqClient) {
        console.log('🟢 Mencoba Groq lagi...');
        const result = await parseWithGroq(text);
        if (result && result.amount > 0) {
            console.log('✅ Groq berhasil (percobaan kedua)!');
            groqAvailable = true;
            return result;
        }
    }

    // 4. Kalau dua-duanya gagal
    console.log('❌ Semua AI gagal, perlu fallback manual.');
    return null;
}

// ====================================================
// PARSER GAMBAR (GEMINI SAJA - Groq gak support vision gratis)
// ====================================================
export async function parseFinancialImage(imageBuffer: Buffer, mimeType: string): Promise<ParsedTransaction | null> {
    if (!genAI) {
        console.log('⚠️ Gemini tidak tersedia untuk parsing gambar.');
        return null;
    }

    try {
        console.log('🔵 Mencoba Gemini Vision...');

        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: "OBJECT" as any,
                    properties: {
                        amount: { type: "INTEGER" as any },
                        description: { type: "STRING" as any },
                        type: { type: "STRING" as any, enum: ['income', 'expense', 'transfer'] },
                        allocated_pocket: { type: "STRING" as any },
                        actor: { type: "STRING" as any, enum: ['suami', 'istri', 'auto'] }
                    },
                    required: ["amount", "description", "type", "allocated_pocket", "actor"]
                } as any
            }
        });

        const imagePart = {
            inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType
            },
        };

        const prompt = `
Parse struk/nota ini ke JSON:
- amount: integer (TOTAL AKHIR)
- description: "Belanja di [Nama Toko]"
- type: "expense"
- allocated_pocket: prediksi (operasional_harian, transportasi_dan_kendaraan, keperluan_bayi, kebutuhan_rutin_bulanan, atau "ASK_USER")
- actor: "auto"
JANGAN tambahkan teks lain.
        `;

        const result = await model.generateContent([prompt, imagePart]);
        const jsonText = result.response.text();
        if (!jsonText) return null;

        const clean = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(clean) as ParsedTransaction;

        console.log('✅ Gemini Vision berhasil!');
        return parsed;

    } catch (error: any) {
        console.error('❌ Gemini Vision error:', error?.message || error);
        return null;
    }
}

// ====================================================
// EXPORT STATUS AI (buat info di feedback)
// ====================================================
export function getAIStatus(): string {
    if (groqAvailable && groqClient) return 'Groq AI (Llama 3.1)';
    if (geminiAvailable && genAI) return 'Gemini AI';
    return 'Parser Manual';
}