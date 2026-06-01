import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import dotenv from 'dotenv';

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
    bill_name?: string;
    installment_name?: string;
}

let groqAvailable = GROQ_API_KEY ? true : false;
let geminiAvailable = GEMINI_API_KEY ? true : false;

// Shared Prompt Builder untuk standarisasi logika berpikir AI (Groq & Gemini)
const getSystemInstruction = () => {
    const hariIni = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `Kamu adalah Moni, AI asisten keuangan keluarga cerdas untuk Qisthi (suami) dan Gita (istri).
Hari ini adalah ${hariIni}.

Output HARUS berupa JSON valid tanpa teks tambahan di luar JSON. Format skema:
{
  "amount": integer (nominal murni rupiah),
  "description": string (Deskripsi singkat, huruf kapital di awal),
  "type": "income" | "expense" | "transfer",
  "transaction_subtype": string (HARUS: "purchase" | "bill_payment" | "installment_payment" | "paylater_payment" | "saving_goal" | "asset_transfer"),
  "allocated_pocket": string (snake_case nama kantong spesifik jika disebutkan, contoh: "listrik_dan_pulsa", "oprasional_bersama", "dana_darurat", "oprasional_qisthi", atau "ASK_USER"),
  "actor": "suami" | "istri" | "auto",
  "category": string (enum: makanan_minuman, elektronik, transportasi, keperluan_bayi, tagihan_rutin, jajan_hiburan, investasi_tabungan, transfer_antar_asset, lainnya),
  "merchant": string (nama merchant/toko/aplikasi/instansi, default "umum"),
  "transaction_date": string (ISO 8601 string hasil deteksi waktu/backdate relatif terhadap hari ini),
  "is_saving_goal": boolean (true jika ada intent menabung untuk target masa depan),
  "goal_name": string atau null (nama barang target tabungan murni tanpa kata kerja, contoh: "Kulkas", "Air Purifier"),
  "bill_name": string atau null (nama tagihan jika bill_payment, contoh: "Listrik PLN", "Wifi IndiHome"),
  "installment_name": string atau null (nama cicilan jika installment_payment, contoh: "Motor Yamaha", "Mobil Toyota")
}

Aturan Ketat Parsing:

1. TRANSACTION_SUBTYPE (CRITICAL - ALWAYS ANALYZE):
   - "bill_payment": Jika ada kata bayar + listrik, token pln, wifi, tagihan, air, gas, internet, cicilan kartu kredit
     Contoh: "Bayar listrik 250rb", "Wifi 300rb", "Token PLN 100rb"
   - "installment_payment": Jika ada kata cicilan, tenor, bayar cicilan
     Contoh: "Cicilan motor 2jt", "Bayar cicilan mobil", "Tenor motor 3jt"
   - "paylater_payment": Jika ada kata gcash, paylater, kredivo, akulaku, shopee paylater, bayar utang
     Contoh: "Bayar GCash 100rb", "Paylater Kredivo 500rb", "Shopee Paylater 250rb"
   - "saving_goal": Jika ada kata nabung, tabung, celengan, untuk impian, beli (barang impian)
     Contoh: "Nabung laptop 2jt", "Tabung air purifier 500rb"
   - "asset_transfer": Jika ada kata transfer, pindah dana, top-up ke rekening/e-wallet
     Contoh: "Transfer ke gopay 100rb", "Pindahin dari mandiri ke bca 500rb", "Top-up gopay 200rb"
   - "purchase": DEFAULT - belanja, jajan, beli (barang konsumsi), bayar service, bayar sewa
     Contoh: "Beli kopi 45rb", "Belanja alfamart 150rb", "Servis motor 500rb"

2. Waktu Kejadian (Backdate): Analisis kata 'kemarin', '2 hari lalu', atau tanggal tertentu, lalu mundurkan dari waktu sekarang ke objek tanggal ISO 8601 yang tepat.

3. Klasifikasi Tipe: 
   - 'income': uang masuk, gaji, bonus, pengembalian dana
   - 'expense': belanja, jajan, bayar tagihan harian/paylater, cicilan
   - 'transfer': memindahkan dana untuk ditabung (saving goals) atau pindah antar rekening

4. Mapping Kantong Otomatis:
   - Bayar listrik, token, pulsa, kuota, wifi -> pocket: "listrik_dan_pulsa", category: "tagihan_rutin", subtype: "bill_payment"
   - Belanja bulanan, operasional rumah tangga, seblak, bakso -> pocket: "oprasional_bersama", category: "makanan_minuman", subtype: "purchase"
   - Nabung/Tabung/Celengan untuk impian -> pocket: "ASK_USER", type: "transfer", category: "investasi_tabungan", is_saving_goal: true, subtype: "saving_goal"
   - Transfer antar asset -> type: "transfer", category: "transfer_antar_asset", allocated_pocket: "ASK_USER", subtype: "asset_transfer"
   - Cicilan -> pocket: sesuai cicilan, category: "tagihan_rutin", subtype: "installment_payment"
   - PayLater -> pocket: "oprasional_bersama", category: "makanan_minuman" atau sesuai, subtype: "paylater_payment"`;
};

export async function parseWithGroq(text: string): Promise<ParsedTransaction | null> {
    if (!groqClient || !GROQ_API_KEY) return null;
    try {
        const response = await groqClient.chat.completions.create({
            model: GROQ_MODEL,
            temperature: 0,
            messages: [
                { role: 'system', content: getSystemInstruction() },
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

export async function parseWithGemini(text: string): Promise<ParsedTransaction | null> {
    if (!genAI || !GEMINI_API_KEY) return null;
    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0
            }
        });

        const prompt = `${getSystemInstruction()}\n\nParse teks transaksi berikut:\n"${text}"`;
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

export async function parseFinancialText(text: string): Promise<ParsedTransaction | null> {
    if (groqAvailable) {
        const result = await parseWithGroq(text);
        if (result && result.amount > 0) return result;
    }
    if (geminiAvailable) {
        const result = await parseWithGemini(text);
        if (result && result.amount > 0) return result;
    }
    return null;
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