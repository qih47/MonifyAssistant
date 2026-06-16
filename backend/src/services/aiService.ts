import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { supabase } from '../config/supabaseClient.js';

dotenv.config();

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const groqClient = GROQ_API_KEY ? new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
}) : null;

export interface ParsedTransaction {
    amount: number;
    description: string;
    type: 'income' | 'expense' | 'transfer';
    transaction_subtype?: 'purchase' | 'bill_payment' | 'installment_payment' | 'paylater_payment' | 'saving_goal' | 'asset_transfer';
    allocated_pocket: string;
    actor: 'suami' | 'istri' | 'auto';
    category: string;
    merchant: string;
    transaction_date: string;
    is_saving_goal: boolean;
    goal_name: string | null;
    bill_name?: string | null;
    installment_name?: string | null;
}

interface DatabaseStateSnapshot {
    pockets: Array<{ id: number; name: string; display_name: string; current_balance: number; ownership: string }>;
    assets: Array<{ id: number; name: string; balance: number; gold_weight_gram?: number; category: string; ownership: string }>;
    unpaidBills: Array<{ id: number; name: string; amount: number }>;
    activeInstallments: Array<{ id: number; name: string; monthly_amount: number; paid_months: number; tenor_months: number }>;
}

let groqAvailable = GROQ_API_KEY ? true : false;
let geminiAvailable = GEMINI_API_KEY ? true : false;

async function fetchDatabaseStateSnapshot(): Promise<DatabaseStateSnapshot | undefined> {
    try {
        const [pocketsResult, assetsResult, billsResult, installmentsResult] = await Promise.all([
            supabase.from('pockets').select('id, name, display_name, current_balance, ownership'),
            supabase.from('assets').select('id, name, balance, gold_weight_gram, category, ownership'),
            supabase.from('bills').select('id, name, amount').eq('status', 'unpaid'),
            supabase.from('installments').select('id, name, monthly_amount, paid_months, tenor_months')
        ]);

        const activeInstallments = (installmentsResult.data || [])
            .filter(i => Number(i.tenor_months) > Number(i.paid_months));

        return {
            pockets: pocketsResult.data || [],
            assets: assetsResult.data || [],
            unpaidBills: billsResult.data || [],
            activeInstallments
        };
    } catch (error) {
        console.error('❌ Failed to fetch database state snapshot:', error);
        return undefined;
    }
}

// FORMATTER SYSTEM INSTRUCTION YANG SUDAH DIOPTIMALKAN (BEBAS KEYWORD KAKU)
const getSystemInstruction = (dbSnapshot?: DatabaseStateSnapshot) => {
    const hariIni = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    let contextData = '';
    if (dbSnapshot) {
        const pocketsList = dbSnapshot.pockets.map(p => `- ${p.name} [Display: ${p.display_name || p.name}] (${p.ownership}): Rp ${Number(p.current_balance).toLocaleString('id-ID')}`).join('\n');
        const assetsList = dbSnapshot.assets.map(a => {
            const balanceInfo = a.category?.includes('emas') || a.category?.includes('gold') 
                ? `${a.gold_weight_gram || 0} gram` 
                : `Rp ${Number(a.balance).toLocaleString('id-ID')}`;
            return `- ${a.name} (${a.ownership}): ${balanceInfo}`;
        }).join('\n');
        const billsList = dbSnapshot.unpaidBills.length > 0 
            ? dbSnapshot.unpaidBills.map(b => `- ${b.name}: Rp ${Number(b.amount).toLocaleString('id-ID')}`).join('\n')
            : 'Tidak ada tagihan unpaid';
        const installmentsList = dbSnapshot.activeInstallments.length > 0
            ? dbSnapshot.activeInstallments.map(i => `- ${i.name}: Rp ${Number(i.monthly_amount).toLocaleString('id-ID')}/bulan`).join('\n')
            : 'Tidak ada cicilan aktif';
        
        contextData = `
\n📊 DATA KEUANGAN REAL-TIME KELUARGA (Valid & Aktual):
\n💼 KANTONG ANGGARAN SAAT INI:\n${pocketsList}
\n🏦 ASET FISIK:\n${assetsList}
\n📋 TAGIHAN BELUM DIBAYAR (BILLS):\n${billsList}
\n🏠 CICILAN AKTIF (INSTALLMENTS):\n${installmentsList}\n`;
    }
    
    return `Kamu adalah Moni, AI asisten keuangan keluarga cerdas untuk Qisthi (suami) dan Gita (istri).
Hari ini adalah ${hariIni}.${contextData}

Output HARUS berupa JSON valid tanpa teks tambahan di luar JSON. Format skema:
{
  "amount": integer (nominal murni rupiah),
  "description": string (Deskripsi singkat, huruf kapital di awal),
  "type": "income" | "expense" | "transfer",
  "transaction_subtype": "purchase" | "bill_payment" | "installment_payment" | "paylater_payment" | "saving_goal" | "asset_transfer",
  "allocated_pocket": string (Nama 'name' kantong spesifik dari data real-time, atau "ASK_USER"),
  "actor": "suami" | "istri" | "auto",
  "category": "makanan_minuman" | "elektronik" | "transportasi" | "keperluan_bayi" | "tagihan_rutin" | "jajan_hiburan" | "investasi_tabungan" | "transfer_antar_asset" | "lainnya",
  "merchant": string (Nama merchant/toko/aplikasi/penyedia jasa, default "umum"),
  "transaction_date": string (ISO 8601 string hasil deteksi waktu),
  "is_saving_goal": boolean,
  "goal_name": string | null,
  "bill_name": string | null,
  "installment_name": string | null
}

⚠️ ATURAN REASONING & KLASIFIKASI KONTEN (PENTING):

1. PENENTUAN TRANSACTION_SUBTYPE & INTELLIGENT ROUTING:
   - JANGAN hanya mencocokkan kata kerja seperti "bayar" atau "cicil". Pahami maksud kontekstual kalimatnya.
   - "bill_payment": Set jika pengguna membayar sesuatu yang COCOK atau mirip dengan daftar "TAGIHAN BELUM DIBAYAR (BILLS)" di atas. Jika user bilang "Bayar Wifi" dan di daftar bills ada "Wifi IndiHome", maka ini adalah bill_payment (isi bill_name: "Wifi IndiHome").
   - "installment_payment": Set jika pengguna membayar sesuatu yang COCOK dengan daftar "CICILAN AKTIF (INSTALLMENTS)" di atas.
   - "paylater_payment": Set jika ada konteks pelunasan utang aplikasi paylater (Kredivo, Shopee Paylater, Akulaku).
   - "saving_goal": Set jika tujuannya adalah menabung/menyisihkan uang untuk target masa depan (misal: "Nabung buat kulkas").
   - "asset_transfer": Set jika memindahkan uang antar rekening sendiri atau top-up e-wallet (GoPay, OVO, dll).
   - "purchase" (DEFAULT PENGELUARAN): Jika pengguna menggunakan kata "bayar", "beli", atau "jajan" untuk jasa/barang konsumsi umum yang TIDAK ADA di daftar TAGIHAN/CICILAN resmi, maka ia adalah "purchase". 
     * Contoh: "bayar cukur rambut 35rb" -> Jasa pangkas rambut tidak ada di daftar tagihan bulanan, maka subtype: "purchase", category: "lainnya" / "jajan_hiburan".
     * Contoh: "bayar servis motor" -> subtype: "purchase", category: "transportasi".

2. MAPPING KANTONG (allocated_pocket):
   - Selaraskan dengan nama kantong ('name' bukan display_name) yang ada pada DATA KEUANGAN REAL-TIME. 
   - Jika transaksi bersifat pengeluaran harian/rutin rumah tangga (makan, seblak, kebutuhan dapur) masuk ke "oprasional_bersama".
   - Jika tidak ditemukan relasi kantong yang pas, isi dengan "ASK_USER".

3. WAKTU KEJADIAN (Backdate):
   - Jika ada kata 'kemarin', '2 hari lalu', sesuaikan tanggalnya mundur dari hari ini secara akurat ke bentuk ISO 8601.`;
};

export async function parseWithGroq(text: string, dbSnapshot?: DatabaseStateSnapshot): Promise<ParsedTransaction | null> {
    if (!groqClient || !GROQ_API_KEY) return null;
    try {
        const response = await groqClient.chat.completions.create({
            model: GROQ_MODEL,
            temperature: 0,
            messages: [
                { role: 'system', content: getSystemInstruction(dbSnapshot) },
                { role: 'user', content: text }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 350,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) return null;
        return JSON.parse(content);
    } catch (error: any) {
        if (error?.status === 429) groqAvailable = false;
        return null;
    }
}

export async function parseWithGemini(text: string, dbSnapshot?: DatabaseStateSnapshot): Promise<ParsedTransaction | null> {
    if (!genAI || !GEMINI_API_KEY) return null;
    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0
            }
        });

        const prompt = `${getSystemInstruction(dbSnapshot)}\n\nParse teks transaksi berikut:\n"${text}"`;
        const result = await model.generateContent(prompt);
        const jsonText = result.response.text();
        if (!jsonText) return null;

        const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error: any) {
        if (error?.status === 429) geminiAvailable = false;
        return null;
    }
}

// Main parsing function with automatic database state injection
export async function parseFinancialText(text: string): Promise<ParsedTransaction | null> {
    // Fetch lean database state snapshot for context injection
    const dbSnapshot = await fetchDatabaseStateSnapshot();
    
    if (groqAvailable) {
        const result = await parseWithGroq(text, dbSnapshot);
        if (result && result.amount > 0) return result;
    }
    if (geminiAvailable) {
        const result = await parseWithGemini(text, dbSnapshot);
        if (result && result.amount > 0) return result;
    }
    return null;
}

// Dedicated function for informational queries (balance checks, summaries) - uses DB context for accurate responses
export async function queryWithAIContext(userMessage: string, userName: string): Promise<string> {
    const dbSnapshot = await fetchDatabaseStateSnapshot();
    
    if (groqClient && groqAvailable) {
        try {
            const response = await groqClient.chat.completions.create({
                model: GROQ_MODEL,
                temperature: 0.5,
                messages: [
                    { 
                        role: 'system', 
                        content: `Kamu adalah Moni, asisten keuangan keluarga yang profesional, informatif, dan friendly. Panggil user "${userName}" atau "Kak". Bahasa Indonesia yang baik, jelas, dan to the point. JANGAN gunakan kata "gue", "lo", "cuy". Singkat 1-2 kalimat. Gunakan DATA KEUANGAN REAL-TIME berikut untuk memberikan jawaban yang akurat:\n${dbSnapshot ? `\n📊 DATA KEUANGAN:\n💼 Kantong: ${dbSnapshot.pockets.map(p => `${p.display_name || p.name}: Rp ${Number(p.current_balance).toLocaleString('id-ID')}`).join(', ')}\n🏦 Aset: ${dbSnapshot.assets.map(a => `${a.name}: ${a.category?.includes('emas') || a.category?.includes('gold') ? `${a.gold_weight_gram || 0} gram` : `Rp ${Number(a.balance).toLocaleString('id-ID')}`}`).join(', ')}` : ''}`
                    },
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 150,
            });
            return response.choices[0]?.message?.content || 'Siap, Kak! 🚀';
        } catch {
            // Fallback to simple response
        }
    }
    return 'Siap, Kak! 🚀';
}

// OPTIMASI PARSER GAMBAR (GEMINI VISION) - MENDUKUNG STRUK STRUK NON-PEMBELIAN (TAGIHAN & PAYLATER)
export async function parseFinancialImage(imageBuffer: Buffer, mimeType: string): Promise<ParsedTransaction | null> {
    if (!genAI) return null;
    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        });

        const imagePart = {
            inlineData: { data: imageBuffer.toString("base64"), mimeType },
        };

        const prompt = `Analisis gambar dokumen keuangan ini (bisa berupa struk belanja, bukti bayar token listrik, tagihan kartu kredit, notifikasi paylater, cicilan, atau transfer m-banking). 
Hari ini adalah ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

Ekstrak informasi secara cerdas ke dalam format JSON dengan aturan:
1. amount: Ambil nominal angka total akhir yang dibayar/ditagihkan.
2. type: Tentukan secara cerdas. Jika struk belanja/pembayaran/tagihan jatuh tempo -> "expense". Jika bukti mutasi pemindahan dana/top-up e-wallet -> "transfer".
3. transaction_subtype: WAJIB tentukan dengan akurat:
   - "bill_payment" - Jika invoice tagihan listrik, air, gas, wifi, kartu kredit
   - "installment_payment" - Jika bukti pembayaran cicilan (cicilan motor, mobil, dll)
   - "paylater_payment" - Jika notifikasi Shopee Paylater, GCash, Kredivo, Akulaku
   - "purchase" - Jika struk belanja toko (Alfamart, Indomaret, mall, restoran, dll)
   - "asset_transfer" - Jika bukti transfer antar rekening/e-wallet
   - DEFAULT: "purchase"
4. merchant: Nama instansi/aplikasi/toko (contoh: "Alfamart", "PLN", "Shopee Paylater", "GoPay", "Kredivo").
5. description: Ringkasan aktivitas, contoh: "Pembayaran Shopee Paylater", "Pembelian Token Listrik", "Belanja di Alfamart".
6. category: Sesuaikan (tagihan_rutin, makanan_minuman, transportasi, elektronik, atau lainnya).
7. allocated_pocket: Prediksi nama kantong terdekat (misal: jika ada kata listrik/pln arahkan ke "listrik_dan_pulsa", jika belanja umum masukkan "oprasional_bersama", jika tidak yakin berikan "ASK_USER").
8. transaction_date: Ekstrak tanggal transaksi yang tertera pada dokumen ke bentuk format ISO 8601 string. Jika tidak ditemukan atau buram, gunakan waktu sekarang.
9. bill_name: Jika bill_payment, ekstrak nama tagihan (contoh: "Listrik PLN", "Wifi IndiHome")
10. installment_name: Jika installment_payment, ekstrak nama cicilan (contoh: "Yamaha Motor", "Toyota Car")

JANGAN berikan teks penjelasan apapun di luar JSON objek.`;

        const result = await model.generateContent([prompt, imagePart]);
        const jsonText = result.response.text();
        if (!jsonText) return null;

        const clean = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(clean);
    } catch (error) {
        console.error('❌ Gemini Vision error:', error);
        return null;
    }
}

export function getAIStatus(): string {
    if (groqAvailable && groqClient) return 'Groq AI (Llama 3.1)';
    if (geminiAvailable && genAI) return 'Gemini AI';
    return 'Parser Manual';
}