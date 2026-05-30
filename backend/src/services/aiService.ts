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
// INTERFACE (SUNTIKAN PROPERTI GRANULAR & GOALS!)
// ==========================================
export interface ParsedTransaction {
    amount: number;
    description: string;
    type: 'income' | 'expense' | 'transfer';
    allocated_pocket: string;
    actor: 'suami' | 'istri' | 'auto';
    category: string;             // FITUR 1: Kategori pengeluaran (makanan_minuman, elektronik, dll)
    merchant: string;             // FITUR 1: Toko tempat beli (sugu, alfamart, dll)
    transaction_date: string;     // FITUR 1: ISO String tanggal pembelian hasil deteksi manual (backdate)
    is_saving_goal: boolean;      // FITUR 4: Menandakan intent menabung
    goal_name: string | null;     // FITUR 4: Nama barang/target yang mau ditabung (kulkas, ac, dll)
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
Hari ini adalah hari Jumat, tanggal 29 Mei 2026.

Output HARUS JSON valid dengan format:
{
  "amount": integer (nominal dalam rupiah),
  "description": string (deskripsi singkat transaksi),
  "type": "income" | "expense" | "transfer",
  "allocated_pocket": string (snake_case: jajan_qisthi, jajan_gita, operasional_utama, transportasi_dan_kendaraan, keperluan_bayi, kebutuhan_rutin_bulanan, tabungan_masa_depan, operasional_harian, atau "ASK_USER"),
  "actor": "suami" | "istri" | "auto",
  "category": string (pilih salah satu enum: makanan_minuman, elektronik, transportasi, keperluan_bayi, tagihan_rutin, jajan_hiburan, investasi_tabungan, sandang, lainnya),
  "merchant": string (nama toko/tempat setelah kata 'di', atau nama instansi jika tagihan, default "umum"),
  "transaction_date": string (ISO 8601 string tanggal transaksi. Jika ada kata 'kemarin' kurangi tanggal hari ini, jika '2 hari lalu' kurangi 2 hari, jika tanggal spesifik seperti '25 mei' ubah ke format tanggal yang benar di tahun 2026. Default gunakan waktu sekarang),
  "is_saving_goal": boolean (true jika user bermaksud menabung untuk target masa depan seperti kulkas, ac, motor, dll. Default false),
  "goal_name": string atau null (jika is_saving_goal true, ekstraksi nama barangnya seperti "Beli Kulkas", "Beli AC", kapital di awal. Jika false masukkan null)
}

Aturan:
- amount: angka integer saja, tanpa titik/koma/Rp. Contoh: 50000
- description: singkat, huruf kapital di awal. Contoh: "Beli Martabak"
- type: "income" untuk uang masuk, "expense" untuk uang keluar, "transfer" untuk pindah saldo / nabung
- allocated_pocket: deteksi dari teks, ubah ke lowercase snake_case. "ASK_USER" jika tidak jelas.
- actor: "istri" jika ada kata Gita/istri/bunda/mama, "suami" jika ada kata saya/aku/Qisthi/ayah, "auto" jika tidak jelas
- Prediksi kantong & kategori jika tidak disebutkan:
  * bensin, servis, parkir -> pocket: "transportasi_dan_kendaraan", category: "transportasi"
  * wifi, listrik, air, tagihan -> pocket: "kebutuhan_rutin_bulanan", category: "tagihan_rutin"
  * bayi, popok, susu -> pocket: "keperluan_bayi", category: "keperluan_bayi"
  * martabak, makan, kopi, jajan -> pocket: "operasional_harian", category: "makanan_minuman"
  * laptop, hp, kulkas, ac -> category: "elektronik"
- Jika teks berupa "nabung beli kulkas 700rb" atau "Nabung Air Purifier 500rb", maka:
  * is_saving_goal: true
  * goal_name: string (Ambil MURNI nama barangnya saja TANPA kata kerja seperti 'Beli' atau 'Buat' di depannya. Contoh jika "Nabung Air Purifier" -> cukup isi "Air Purifier", jika "nabung beli kulkas" -> cukup isi "Kulkas", gunakan Title Case yang bersih)
  * type: "transfer"
  * category: "investasi_tabungan"
JANGAN tambahkan teks apapun selain JSON.`
                },
                { role: 'user', content: text }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 300,
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
            category: parsed.category || 'lainnya',
            merchant: parsed.merchant || 'umum',
            transaction_date: parsed.transaction_date || new Date().toISOString(),
            is_saving_goal: !!parsed.is_saving_goal,
            goal_name: parsed.goal_name || null
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
                        actor: { type: "STRING" as any, enum: ['suami', 'istri', 'auto'] },
                        category: { type: "STRING" as any, enum: ['makanan_minuman', 'elektronik', 'transportasi', 'keperluan_bayi', 'tagihan_rutin', 'jajan_hiburan', 'investasi_tabungan', 'sandang', 'lainnya'] },
                        merchant: { type: "STRING" as any },
                        transaction_date: { type: "STRING" as any },
                        is_saving_goal: { type: "BOOLEAN" as any },
                        goal_name: { type: "STRING" as any, nullable: true }
                    },
                    required: ["amount", "description", "type", "allocated_pocket", "actor", "category", "merchant", "transaction_date", "is_saving_goal", "goal_name"]
                } as any
            }
        });

        const prompt = `
Kamu adalah asisten keuangan keluarga. Hari ini Jumat, 29 Mei 2026.
Parse teks transaksi keuangan ini ke JSON sesuai skema:
"${text}"

Aturan Khusus:
- merchant: nama toko setelah kata 'di', default 'umum'.
- transaction_date: jika ada kata 'kemarin', '2 hari lalu', atau tanggal tertentu, konversi ke format ISO 8601 string yang valid di tahun 2026.
- is_saving_goal: true jika berupa kalimat "nabung beli kulkas" atau "nabung air purifier".
- goal_name: Ambil MURNI nama barang target tabungan secara murni TANPA ditambahkan kata kerja di depannya (Contoh jika "nabung air purifier" -> cukup isi "Air Purifier", jika "beli kulkas" -> cukup "Kulkas").
- JANGAN tambahkan teks selain JSON.
        `;

        const result = await model.generateContent(prompt);
        const jsonText = result.response.text();
        if (!jsonText) return null;

        const clean = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(clean);

        return {
            amount: parsed.amount || 0,
            description: parsed.description || 'Transaksi',
            type: parsed.type || 'expense',
            allocated_pocket: parsed.allocated_pocket || 'ASK_USER',
            actor: parsed.actor || 'auto',
            category: parsed.category || 'lainnya',
            merchant: parsed.merchant || 'umum',
            transaction_date: parsed.transaction_date || new Date().toISOString(),
            is_saving_goal: !!parsed.is_saving_goal,
            goal_name: parsed.goal_name || null
        };

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

    // 1. Coba Groq dulu
    if (groqAvailable) {
        console.log('🟢 Mencoba Groq...');
        const result = await parseWithGroq(text);
        if (result && result.amount > 0) {
            console.log('✅ Groq berhasil!');
            groqAvailable = true;
            return result;
        }
        console.log('⚠️ Groq gagal, switch ke Gemini...');
    }

    // 2. Fallback ke Gemini
    if (geminiAvailable) {
        console.log('🔵 Mencoba Gemini...');
        const result = await parseWithGemini(text);
        if (result && result.amount > 0) {
            console.log('✅ Gemini berhasil!');
            geminiAvailable = true;
            return result;
        }
        console.log('⚠️ Gemini gagal...');
    }

    // 3. Coba balik ke Groq
    if (!groqAvailable && groqClient) {
        console.log('🟢 Mencoba Groq lagi...');
        const result = await parseWithGroq(text);
        if (result && result.amount > 0) {
            console.log('✅ Groq berhasil (percobaan kedua)!');
            groqAvailable = true;
            return result;
        }
    }

    console.log('❌ Semua AI gagal, perlu fallback manual.');
    return null;
}

// ====================================================
// PARSER GAMBAR (GEMINI VISION)
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
                        actor: { type: "STRING" as any, enum: ['suami', 'istri', 'auto'] },
                        category: { type: "STRING" as any, enum: ['makanan_minuman', 'elektronik', 'transportasi', 'keperluan_bayi', 'tagihan_rutin', 'jajan_hiburan', 'investasi_tabungan', 'sandang', 'lainnya'] },
                        merchant: { type: "STRING" as any },
                        transaction_date: { type: "STRING" as any },
                        is_saving_goal: { type: "BOOLEAN" as any },
                        goal_name: { type: "STRING" as any, nullable: true }
                    },
                    required: ["amount", "description", "type", "allocated_pocket", "actor", "category", "merchant", "transaction_date", "is_saving_goal", "goal_name"]
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
Parse struk/nota ini ke JSON dengan detail tinggi. Hari ini Jumat, 29 Mei 2026.
Aturan:
- amount: integer (TOTAL AKHIR YANG DIBAYAR)
- description: "Belanja di [Nama Toko/Merchant]"
- type: "expense"
- merchant: Ekstrak nama toko asli dari struk (Contoh: Alfamart Bojongsoang, Indomaret, Superindo)
- category: Analisis barang dominan yang dibeli (makanan_minuman, keperluan_bayi, elektronik, dll)
- transaction_date: Ekstrak tanggal cetak struk jika terbaca dalam format ISO string. Jika kabur, gunakan waktu sekarang.
- is_saving_goal: false
- goal_name: null
JANGAN tambahkan teks lain.
        `;

        const result = await model.generateContent([prompt, imagePart]);
        const jsonText = result.response.text();
        if (!jsonText) return null;

        const clean = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(clean);

        console.log('✅ Gemini Vision berhasil!');
        return {
            amount: parsed.amount || 0,
            description: parsed.description || 'Belanja Struk',
            type: 'expense',
            allocated_pocket: parsed.allocated_pocket || 'ASK_USER',
            actor: parsed.actor || 'auto',
            category: parsed.category || 'lainnya',
            merchant: parsed.merchant || 'umum',
            transaction_date: parsed.transaction_date || new Date().toISOString(),
            is_saving_goal: false,
            goal_name: null
        };

    } catch (error: any) {
        console.error('❌ Gemini Vision error:', error?.message || error);
        return null;
    }
}

// ====================================================
// EXPORT STATUS AI
// ====================================================
export function getAIStatus(): string {
    if (groqAvailable && groqClient) return 'Groq AI (Llama 3.1)';
    if (geminiAvailable && genAI) return 'Gemini AI';
    return 'Parser Manual';
}