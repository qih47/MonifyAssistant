# 🔍 ANALISIS SISTEM MONIFY & REKOMENDASI OPTIMASI

**Dibuat:** 1 Juni 2026  
**Status:** Draft Analisis Komprehensif

---

## 📋 EXECUTIVE SUMMARY

Sistem Monify memiliki **arsitektur modular yang baik**, namun mengalami beberapa **inconsistency dan logical gaps** yang perlu diperbaiki:

1. ❌ **Pocket Button Logic Confusion** - Button menampilkan kantong, tapi alur data tidak konsisten
2. ❌ **Asset Deduction Imperfect** - Asset berkurang belum sempurna untuk semua alur
3. ❌ **OCR Hardcoded as Expense Only** - Tidak support bill/installment/paylater via OCR
4. ❌ **Help Command Inaccurate** - Menampilkan fitur yang tidak ada
5. ❌ **AI Parser Output Inconsistency** - `allocated_pocket` field tidak dihandle dengan baik
6. ❌ **Naming & ID Mismatch** - Pocket name vs ID tidak konsisten di berbagai layer

---

## 🔴 ISSUE #1: Pocket Button Logic & Asset Linking Confusion

### Problem Statement

**Current Flow (Transaction Handler):**

```
User input "Bayar listrik 250rb"
    ↓
AI Parse → allocated_pocket: "listrik_dan_pulsa"
    ↓
getPocketButtons() fetch pockets dari DB
    ↓
Button callback: p:<txId>:<pocket_name> (string!)
    ↓
transactionCallback.ts:
    - getPocketByName(selectedPocket) ← Cari pocket by name
    - pocketData.asset_id ← Link ke asset
    - Update pocket balance
    - Update asset balance
```

**Issue:**

- Callback data menggunakan **pocket name (string)** bukan pocket ID
- Di `transactionCallback`, mixing antara `finalPocketId` (hasil getPocketByName) dengan `pocket_name`
- Asset linking hanya bekerja jika pocket punya `asset_id` kolom (mungkin NULL untuk beberapa pocket)
- **OCR Handler tidak punya logic asset linking sama sekali** ← Cuma hardcode `type: "expense"`

### Root Cause Analysis

1. **Database Schema Issue:**

   ```sql
   -- pockets table tidak memiliki asset_id relationship?
   -- atau asset_id NULL untuk beberapa pocket?
   ```

2. **Handler Inconsistency:**
   - `buttons.ts` → callback data format: `p:<txId>:<pocket_name>`
   - `transactionCallback.ts` → expect pocket_name, call `getPocketByName()`
   - `receiptHandler.ts` → same pattern tapi NO asset linking

3. **OCR Gap:**
   - `receiptHandler.ts` line ~32: `type: "expense"` hardcoded
   - Tidak ada logic untuk detect apakah foto adalah tagihan atau purchase
   - Always menampilkan 🔴 Tipe: _Pengeluaran_

### Rekomendasi Fix

#### Step 1: Normalize Pocket-Asset Relationship

**File: Update Database Schema Documentation**

```typescript
// Ensure pockets table structure:
interface Pocket {
  id: bigint; // Primary key
  name: string; // System name (snake_case)
  display_name: string; // User-facing name
  current_balance: bigint;
  ownership: "bersama" | "suami" | "istri";
  asset_id: bigint; // ← CRITICAL: Must NOT be NULL (link ke assets)
  monthly_budget?: bigint;
  created_at: timestamp;
}

// Ensure SETIAP pocket has valid asset_id
// Seed data:
// - "listrik_dan_pulsa" → asset_id: <Bank BCA or default asset>
// - "operasional_bersama" → asset_id: <Bank BCA>
// - "keperluan_bayi" → asset_id: <Bank BCA>
```

**Action:**

```sql
-- Verify semua pocket punya asset_id yang valid
SELECT id, name, asset_id FROM pockets WHERE asset_id IS NULL;
-- If ada NULL, UPDATE with default asset_id (Bank BCA atau yang active)
UPDATE pockets SET asset_id = 1 WHERE asset_id IS NULL;
```

#### Step 2: Fix getPocketButtons Return Format

**File: `helpers/buttons.ts`**

```typescript
// CURRENT (Problematic):
callback_data: `p:${txId}:${p.name}`; // <- p.name is string

// RECOMMENDED:
// Return BOTH pocket ID dan pocket name untuk clarity
callback_data: `p:${txId}:${p.id}`; // <- Use ID, not name
// OR store pocket ID di pending transaction untuk quick lookup
```

#### Step 3: Update transactionCallback.ts

```typescript
// CURRENT:
const selectedPocket = parts[2]; // Could be name or ID
const pocketData = await getPocketByName(selectedPocket); // Fragile

// RECOMMENDED:
const pocketId = Number(parts[2]);
const pocketData = await getPocketById(pocketId); // Direct, safer
// Add getPocketById service if not exist
```

#### Step 4: Fix OCR Handler Asset Linking

**File: `handlers/photo/receiptHandler.ts`**

```typescript
// CURRENT:
const txId = 'img' + Date.now().toString(36) + ...;
pendingTransactions.set(txId, {
    amount, actor: finalActor, description, type, timestamp: Date.now(),
    category, merchant, transaction_date
    // ❌ NO asset_id stored!
});

// RECOMMENDED:
// Detect receipt type (purchase vs bill vs paylater) from description
const receiptType = detectReceiptType(description);  // NEW FUNCTION
// receiptType can be: 'purchase' | 'bill' | 'paylater' | 'unknown'

// Map receipt type to suggested pocket & asset
const { suggestedPocket, detectedType } = mapReceiptToPocket(receiptType, description, category);

pendingTransactions.set(txId, {
    amount,
    actor: finalActor,
    description,
    type: detectedType,  // Changed from hardcoded 'expense'
    timestamp: Date.now(),
    category,
    merchant,
    transaction_date,
    receipt_type: receiptType  // NEW: Track original receipt context
});

// Show appropriate UI based on type
if (receiptType === 'bill') {
    // Show "Bayar Tagihan" UI variant
    showBillPaymentConfirmation(ctx, txId, description, amount);
} else if (receiptType === 'paylater') {
    // Show "Bayar PayLater" UI variant
    showPaylaterPaymentConfirmation(ctx, txId, description, amount);
} else {
    // Default: purchase confirmation
    showPurchaseConfirmation(ctx, txId, ...);
}
```

---

## 🔴 ISSUE #2: OCR Only Handles Purchases, Not Bills/Installments/Paylater

### Problem Statement

Currently, OCR receipt handling:

```
Photo → OCR Parse → Always type: "expense" & category: auto-detected
    ↓
Shows: "KONFIRMASI ALOKASI DANA (STRUK)"
    ↓
Always maps to: "operasional_bersama" or "jajan_*" pockets
    ↓
Ignores: Bills, Installments, PayLater, Transfer scenarios
```

**Supported OCR scenarios:**

- ✅ Belanja groceries (Indomaret, Alfamart)
- ✅ Makan/Kopi
- ✅ Generic purchase

**NOT Supported:**

- ❌ Tagihan (listrik, internet, dll) → Should show "Bayar Tagihan" flow, not just expense
- ❌ PayLater (GCash, PayLater) → Should match dengan daftar paylater di sistem
- ❌ Installment (cicilan motor) → Should trigger "Bayar Cicilan" confirmation
- ❌ Transfer (bank transfer receipts) → Should detect & map correctly

### Root Cause

`receiptHandler.ts` tidak punya:

1. Receipt type detection logic
2. Mapping ke bill/installment/paylater entities
3. Conditional UI based on receipt type

### Rekomendasi Fix

#### Step 1: Create Receipt Type Detector Service

**File: Create `services/receiptDetector.ts`**

```typescript
export interface ReceiptAnalysis {
  type:
    | "purchase"
    | "bill"
    | "paylater"
    | "installment"
    | "transfer"
    | "unknown";
  confidence: number; // 0-100
  suggestedEntity?: string; // bill name, paylater name, installment name
  reasoning: string;
}

export async function analyzeReceiptImage(
  imageBuffer: Buffer,
): Promise<ReceiptAnalysis> {
  // Use Gemini Vision to analyze receipt content
  // Look for keywords:
  // - "listrik", "token pln", "tagihan bulanan" → 'bill'
  // - "GCash", "Kredivo", "Akulaku", "PayLater" → 'paylater'
  // - "cicilan", "tenor" → 'installment'
  // - "transfer", "reference" → 'transfer'
  // - Default → 'purchase'

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-vision" });

  const prompt = `Analyze this receipt image. Identify the type:
    - 'bill': if this is a utility bill (listrik, air, gas, internet, etc)
    - 'paylater': if this is a payment to PayLater app (GCash, Kredivo, etc)
    - 'installment': if this is an installment payment
    - 'transfer': if this is a bank transfer
    - 'purchase': if this is a regular purchase (shopping, food, etc)
    
    Return JSON: {
        "type": "bill|paylater|installment|transfer|purchase",
        "confidence": 95,
        "entity_name": "Listrik PLN" or null,
        "reasoning": "Detected dari keywords: token pln, kwh, etc"
    }`;

  const result = await model.generateContent({
    inlineData: {
      mimeType: "image/jpeg",
      data: imageBuffer.toString("base64"),
    },
    parts: [{ text: prompt }],
  });

  return JSON.parse(result.response.text());
}

export async function mapReceiptToEntity(
  analysis: ReceiptAnalysis,
  amount: number,
): Promise<{ pocket: string; asset_id: number; handler: string }> {
  // Map analyzed receipt type to appropriate handler & pocket

  if (analysis.type === "bill") {
    // Find matching bill in database
    const { data: bills } = await supabase
      .from("bills")
      .select("id, name, pocket_id")
      .ilike("name", `%${analysis.entity_name}%`)
      .limit(1);

    if (bills?.length > 0) {
      return {
        pocket: bills[0].name,
        asset_id: null, // Will get from pocket
        handler: "bill_payment", // Route to bill payment handler
      };
    }
  }

  if (analysis.type === "paylater") {
    // Return paylater-specific handling
    return {
      pocket: "operasional_bersama", // Default
      asset_id: null,
      handler: "paylater_payment",
    };
  }

  if (analysis.type === "installment") {
    // Match dengan installment list
    const { data: installments } = await supabase
      .from("installments")
      .select("id, name, pocket_id")
      .ilike("name", `%${analysis.entity_name}%`)
      .limit(1);

    if (installments?.length > 0) {
      return {
        pocket: installments[0].name,
        asset_id: null,
        handler: "installment_payment",
      };
    }
  }

  // Default: treat as purchase
  return {
    pocket: "operasional_utama",
    asset_id: null,
    handler: "transaction",
  };
}
```

#### Step 2: Update receiptHandler.ts

**File: `handlers/photo/receiptHandler.ts`** (ENHANCED)

```typescript
import {
  analyzeReceiptImage,
  mapReceiptToEntity,
} from "../../services/receiptDetector.js";

export async function handlePhotoMessage(ctx: any) {
  try {
    await ctx.reply("📸 Moni sedang membaca struk...");
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
    const response = await axios.get(fileUrl.href, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const imageBuffer = Buffer.from(response.data);

    // STEP 1: Parse financial data (amount, description, etc)
    const hasilParse = await parseFinancialImage(imageBuffer, "image/jpeg");

    if (!hasilParse) {
      await ctx.reply(
        "❌ Gagal membaca struk. Coba upload ulang atau ketik manual.",
      );
      return;
    }

    // STEP 2: NEW - Analyze receipt type & map to handler
    const receiptAnalysis = await analyzeReceiptImage(imageBuffer);
    const entityMapping = await mapReceiptToEntity(
      receiptAnalysis,
      hasilParse.amount,
    );

    const {
      amount,
      description,
      actor: aiActor,
      category,
      merchant,
      transaction_date,
    } = hasilParse;
    const finalActor = aiActor === "auto" ? ctx.state.actor : aiActor;
    const txId =
      "img" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    // STEP 3: Store dengan receipt type info
    pendingTransactions.set(txId, {
      amount,
      actor: finalActor,
      description,
      type: entityMapping.handler === "transaction" ? "expense" : "expense", // Adjust based on handler
      timestamp: Date.now(),
      category,
      merchant,
      transaction_date,
      receipt_analysis: receiptAnalysis, // NEW
      suggested_handler: entityMapping.handler, // NEW
    });

    // STEP 4: Route to appropriate handler based on receipt type
    if (receiptAnalysis.type === "bill" && receiptAnalysis.confidence > 70) {
      await showBillPaymentFlow(ctx, txId, hasilParse, receiptAnalysis);
      return;
    }

    if (
      receiptAnalysis.type === "paylater" &&
      receiptAnalysis.confidence > 70
    ) {
      await showPaylaterPaymentFlow(ctx, txId, hasilParse, receiptAnalysis);
      return;
    }

    if (
      receiptAnalysis.type === "installment" &&
      receiptAnalysis.confidence > 70
    ) {
      await showInstallmentPaymentFlow(ctx, txId, hasilParse, receiptAnalysis);
      return;
    }

    // Default: Regular purchase
    await showPurchaseConfirmation(ctx, txId, hasilParse);
  } catch (error) {
    console.error("❌ Error foto:", error);
    await ctx.reply("❌ Gangguan teknis saat membaca struk.");
  }
}

// NEW: Helper untuk show bill payment flow
async function showBillPaymentFlow(
  ctx: any,
  txId: string,
  parsed: any,
  analysis: any,
) {
  const { amount, description, merchant, transaction_date } = parsed;
  const formattedAmount = formatIDR(amount);
  const dateText = new Date(transaction_date).toLocaleDateString("id-ID");

  // Get bills matching this receipt
  const { data: matchingBills } = await supabase
    .from("bills")
    .select("id, name, pocket_id, status")
    .ilike("name", `%${analysis.entity_name || merchant}%`);

  if (matchingBills?.length === 0) {
    // No bill found, offer manual entry
    await ctx.reply(
      `🧾 Struk terdeteksi sebagai *TAGIHAN*\n\n` +
        `Namun Moni tidak menemukan tagihan "${analysis.entity_name}" di database.\n\n` +
        `Pilih opsi:\n` +
        `1️⃣ Catat sebagai pengeluaran biasa\n` +
        `2️⃣ Buat tagihan baru\n` +
        `3️⃣ Batalkan`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  // Show which bill to pay
  const buttons = matchingBills.map((bill) => [
    {
      text: `💳 ${bill.name}`,
      callback_data: `paybill_ocr:${txId}:${bill.id}`,
    },
  ]);
  buttons.push([{ text: "❌ Batal", callback_data: `cancel:${txId}` }]);

  await ctx.reply(
    `🧾 *PEMBAYARAN TAGIHAN (OCR)*\n\n` +
      `Struk terdeteksi sebagai tagihan.\n` +
      `Pilih tagihan yang ingin dibayar:`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } },
  );
}

// NEW: Helper untuk show paylater payment flow
async function showPaylaterPaymentFlow(
  ctx: any,
  txId: string,
  parsed: any,
  analysis: any,
) {
  const { amount, description, merchant, transaction_date } = parsed;
  const formattedAmount = formatIDR(amount);

  await ctx.reply(
    `💳 *PEMBAYARAN PAYLATER (OCR)*\n\n` +
      `Struk terdeteksi: ${analysis.entity_name || "PayLater Application"}\n` +
      `Nominal: ${formattedAmount}\n\n` +
      `Pilih sumber dana pembayaran:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: await getPocketButtons(txId),
      },
    },
  );
}

// NEW: Helper untuk show installment payment flow
async function showInstallmentPaymentFlow(
  ctx: any,
  txId: string,
  parsed: any,
  analysis: any,
) {
  const { amount, description } = parsed;

  // Match installment
  const { data: matchingInstallments } = await supabase
    .from("installments")
    .select("id, name, pocket_id")
    .ilike("name", `%${analysis.entity_name}%`);

  if (!matchingInstallments?.length) {
    await ctx.reply("❌ Cicilan tidak ditemukan. Catat manual lewat /cicil");
    return;
  }

  const buttons = matchingInstallments.map((inst) => [
    {
      text: `🏍️ ${inst.name}`,
      callback_data: `payinstall_ocr:${txId}:${inst.id}`,
    },
  ]);
  buttons.push([{ text: "❌ Batal", callback_data: `cancel:${txId}` }]);

  await ctx.reply(
    `🏍️ *PEMBAYARAN CICILAN (OCR)*\n\n` + `Pilih cicilan yang ingin dibayar:`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } },
  );
}

// Regular purchase confirmation (existing logic)
async function showPurchaseConfirmation(
  ctx: any,
  txId: string,
  hasilParse: any,
) {
  // ... existing code ...
}
```

---

## 🔴 ISSUE #3: Help Command Displays Non-existent Features

### Problem Statement

**Current Help Command Output:**

```
💰 *Cek Saldo*
/saldo atau "saldo"

📊 *Ringkasan Bulanan*
/ringkasan atau "rekap"

... (continues with existing features)

• 📉 *Alokasi Budget:* `cek budget bulan ini`  ← ❌ DOES NOT EXIST
```

**Issues:**

- Mentions "cek budget" yang tidak ada handler
- Tidak mention OCR improvements yang baru (bill/paylater/installment via foto)
- Says "📸 _Struk Belanja_" tapi seharusnya lebih general "Struk/Nota" (includes bills)

### Rekomendasi Fix

**File: `bot/commands.ts`** - Update help command

```typescript
bot.command("help", async (ctx) => {
  return await ctx.reply(
    `━━━━━━━━━━━━━━━━━━━━━━━━\n🤖 *MONI - ASISTEN KEUANGAN KELUARGA*\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Aku Moni, pembantu keuangan keluargamu. Berikut fitur yang bisa aku lakukan:\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *1. CATAT TRANSAKSI OTOMATIS*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Ketik pesan natural & AI aku deteksi nominal, kategori, tipe:\n` +
      `• 🛍️ *Belanja:* \`Beli kopi starbucks 45rb\`\n` +
      `• 💵 *Gaji:* \`Gaji masuk 8.5jt\`\n` +
      `• 📸 *Struk/Nota:* Kirim foto dari Indomaret, invoice tagihan, dll\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💳 *2. BAYAR TAGIHAN & CICILAN*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Kelola pembayaran rutin dengan mudah:\n` +
      `• 🌐 *Tagihan:* \`/bayar wifi\` atau \`bayar listrik\`\n` +
      `• 🏍️ *Cicilan:* \`/cicil motor\` atau \`cicil mobil 2.5jt\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 *3. KELOLA TABUNGAN & TARGET*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Nabung untuk barang impian:\n` +
      `• 📥 *Nabung:* \`Nabung beli laptop 2jt\`\n` +
      `• 🔍 *Cek Progress:* \`cek tabungan\` atau \`progres impian\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *4. MONITORING & LAPORAN*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Pantau kesehatan finansial keluarga:\n` +
      `• 💰 *Cek Saldo:* \`/saldo\` atau \`cek saldo\`\n` +
      `• 📋 *Rekap Bulanan:* \`/ringkasan\` atau \`rekap\`\n` +
      `• 📁 *Export Data:* \`/laporan\` atau \`export csv\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *TIPS PENGGUNAAN*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✓ Ketik pesan dengan santai, Moni akan mengerti\n` +
      `✓ Bisa menyebutkan kapan: "kemarin beli", "2 hari lalu bayar"\n` +
      `✓ Kirim foto struk atau nota pembayaran untuk scan otomatis\n` +
      `✓ Moni available 24/7 untuk membantu\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚀 Ayo mulai kelola keuangan keluarga dengan smart! 💪`,
    { parse_mode: "Markdown", link_preview_options: { is_disabled: true } },
  );
});
```

---

## 🔴 ISSUE #4: AI Parser Output Inconsistency

### Problem Statement

**Current AI Response Format:**

```json
{
  "amount": 250000,
  "description": "Bayar listrik",
  "type": "expense",
  "allocated_pocket": "listrik_dan_pulsa", // ← Can be pocket name or "ASK_USER"
  "actor": "auto",
  "category": "tagihan_rutin",
  "merchant": "PLN",
  "transaction_date": "2026-01-06",
  "is_saving_goal": false,
  "goal_name": null
}
```

**Problems:**

1. `allocated_pocket` sometimes returns "ASK_USER" → system doesn't handle this properly
2. No distinction between:
   - "Bayar listrik 250rb" (should be bill payment, not expense)
   - "Transfer ke gopay 100rb" (should trigger asset transfer)
   - "Nabung laptop 2jt" (should trigger saving goal)
3. For bills/installments detected from OCR, `allocated_pocket` may be wrong

### Recomendation Fix

#### Enhance AI Prompt

**File: `services/aiService.ts`** - Update system instruction

```typescript
const getSystemInstruction = () => {
  const hariIni = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `Kamu adalah Moni, AI asisten keuangan keluarga cerdas untuk Qisthi (suami) dan Gita (istri).
Hari ini adalah ${hariIni}.

OUTPUT HARUS JSON VALID TANPA TEKS LAIN. Schema:
{
  "amount": number,
  "description": string (singkat, capitalized),
  "type": "income" | "expense" | "transfer",
  "transaction_subtype": "purchase" | "bill_payment" | "installment_payment" | "paylater_payment" | "saving_goal" | "asset_transfer",
  "allocated_pocket": string (snake_case, JANGAN "ASK_USER" - selalu specific),
  "actor": "suami" | "istri" | "auto",
  "category": string (enum: makanan_minuman, elektronik, transportasi, keperluan_bayi, tagihan_rutin, jajan_hiburan, investasi_tabungan, transfer_antar_asset, lainnya),
  "merchant": string (nama toko/app/institusi),
  "transaction_date": string (ISO 8601),
  "is_saving_goal": boolean,
  "goal_name": string | null,
  "bill_name": string | null (jika tagihan, nama bill yang cocok),
  "installment_name": string | null (jika cicilan)
}

CRITICAL RULES:

1. JANGAN output "ASK_USER" - SELALU pilih pocket spesifik:
   - Bayar listrik/wifi → pocket: "listrik_dan_pulsa" (category: tagihan_rutin)
   - Belanja bulanan → pocket: "operasional_utama" (category: makanan_minuman)
   - Jajan Qisthi → pocket: "operasional_qisthi"
   - Jajan Gita → pocket: "operasional_gita"
   - Nabung/Tabung → pocket: "tabungan_masa_depan" + is_saving_goal: true
   - Transfer ke asset → pocket: "operasional_utama" (type: transfer, category: transfer_antar_asset)

2. DETECT transaction_subtype akurat:
   - "bayar listrik", "bayar wifi", "tagihan" → bill_payment
   - "cicilan motor", "cicil mobil" → installment_payment
   - "bayar GCash", "bayar paylater" → paylater_payment
   - "nabung", "tabung", "celengan" → saving_goal
   - "transfer ke gopay", "pindah ke mandiri" → asset_transfer
   - Else → purchase

3. Untuk bill_payment & installment_payment:
   - set bill_name / installment_name
   - type: "expense"
   - category: "tagihan_rutin"

4. Waktu Backdate:
   - "kemarin" → yesterday date
   - "2 hari lalu" → 2 days ago
   - "tanggal 5" → set ke tanggal 5 bulan ini atau lalu

5. Actor:
   - "saya", "aku", "qisthi" → suami
   - "gita", "istri", "kamu" → istri
   - Jika tidak disebutkan → auto

CONTOH INPUT & OUTPUT:

Input: "Bayar listrik 250rb"
Output: {
  "amount": 250000,
  "description": "Bayar listrik",
  "type": "expense",
  "transaction_subtype": "bill_payment",  ← NEW
  "allocated_pocket": "listrik_dan_pulsa",  ← SPECIFIC
  "actor": "auto",
  "category": "tagihan_rutin",
  "merchant": "PLN",
  "transaction_date": "2026-06-01",
  "is_saving_goal": false,
  "goal_name": null,
  "bill_name": "Listrik PLN",  ← NEW
  "installment_name": null
}

Input: "Transfer ke gopay 100rb buat bayar online"
Output: {
  "amount": 100000,
  "description": "Transfer ke GoPay",
  "type": "transfer",
  "transaction_subtype": "asset_transfer",  ← NEW
  "allocated_pocket": "operasional_utama",
  "actor": "auto",
  "category": "transfer_antar_asset",
  "merchant": "GoPay",
  "transaction_date": "2026-06-01",
  "is_saving_goal": false,
  "goal_name": null,
  "bill_name": null,
  "installment_name": null
}`;
};
```

#### Update Transaction Handler

**File: `handlers/text/transactionHandlers.ts`**

```typescript
export async function handleFinancialText(
  ctx: any,
  pesanAsli: string,
  userName: string,
) {
  if (!isPotentialTransaction(pesanAsli)) {
    return false;
  }

  await ctx.reply("⏳ Sebentar, Moni proses transaksinya...");
  let hasilParse = null;

  try {
    hasilParse = await parseFinancialText(pesanAsli);
  } catch (error) {
    // AI parsing gagal, lanjut ke fallback manual
  }

  if (!hasilParse) {
    const manualResult = parseTransactionManual(pesanAsli);
    if (manualResult) {
      hasilParse = manualResult as any;
    }
  }

  if (!hasilParse) {
    await ctx.reply(
      '❌ Tidak mengerti. Coba: "Beli kopi 35rb" atau "Bayar listrik 250rb"',
    );
    return true;
  }

  const {
    amount,
    description,
    type,
    actor: aiActor,
    category,
    merchant,
    transaction_date,
    is_saving_goal,
    goal_name,
    transaction_subtype, // NEW
    bill_name, // NEW
    installment_name, // NEW
  } = hasilParse;

  const finalActor = aiActor === "auto" ? ctx.state.actor : aiActor;
  const txId =
    (is_saving_goal ? "sg" : "tx") +
    Date.now().toString(36) +
    Math.random().toString(36).substr(2, 4);

  pendingTransactions.set(txId, {
    amount,
    actor: finalActor,
    description,
    type,
    timestamp: Date.now(),
    category,
    merchant,
    transaction_date,
    is_saving_goal,
    goal_name,
    transaction_subtype, // NEW
    bill_name, // NEW
    installment_name, // NEW
  });

  // ROUTE BASED ON transaction_subtype
  if (transaction_subtype === "bill_payment") {
    return await handleBillPaymentFlow(ctx, txId, hasilParse);
  }

  if (transaction_subtype === "installment_payment") {
    return await handleInstallmentPaymentFlow(ctx, txId, hasilParse);
  }

  if (transaction_subtype === "asset_transfer") {
    return await handleAssetTransferFlow(ctx, txId, hasilParse);
  }

  // Default: show regular transaction confirmation
  const formattedAmount = formatIDR(amount);
  const actorEmojiPreview = finalActor === "suami" ? "🧑 Qisthi" : "👩 Gita";
  const keyboardButtons = await getPocketButtons(txId);
  const dateText = new Date(transaction_date).toLocaleDateString("id-ID");

  if (is_saving_goal && goal_name) {
    await ctx.reply(
      `🎯 *KONFIRMASI TARGET TABUNGAN*\n\n` +
        `📦 Target: *${goal_name}*\n` +
        `💰 Setoran: *${formattedAmount}*\n` +
        `👤 Dari: ${actorEmojiPreview}\n\n` +
        `Pilih kantong sumber:`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboardButtons },
      },
    );
  } else {
    const tipeText = type === "income" ? "Pemasukan" : "Pengeluaran";
    const tipeEmoji = type === "income" ? "🟢" : "🔴";

    await ctx.reply(
      `💳 *KONFIRMASI ALOKASI DANA*\n\n` +
        `📝 *${description}*\n` +
        `💰 Nominal: *${formattedAmount}*\n` +
        `🏬 Merchant: *${merchant}*\n` +
        `🏷️ Kategori: *${category.replace("_", " ")}*\n` +
        `📅 Tanggal: *${dateText}*\n` +
        `${tipeEmoji} Jenis: *${tipeText}*\n` +
        `👤 Eksekutor: ${actorEmojiPreview}\n\n` +
        `Pilih sumber dana:`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboardButtons },
      },
    );
  }

  return true;
}

// NEW handlers untuk bill, installment, asset transfer
async function handleBillPaymentFlow(ctx: any, txId: string, parsed: any) {
  const { bill_name, amount, description } = parsed;

  // Find bill matching name
  const { data: bills } = await supabase
    .from("bills")
    .select("id, name")
    .ilike("name", `%${bill_name || ""}%`)
    .limit(3);

  if (!bills || bills.length === 0) {
    // Fallback: show as regular expense
    return await ctx.reply(
      "Tagihan tidak ditemukan. Catat sebagai pengeluaran biasa.",
    );
  }

  const buttons = bills.map((bill) => [
    {
      text: `💳 ${bill.name}`,
      callback_data: `bill_ocr_pay:${txId}:${bill.id}`,
    },
  ]);
  buttons.push([{ text: "❌ Batal", callback_data: `cancel:${txId}` }]);

  await ctx.reply(`Pilih tagihan yang ingin dibayar:`, {
    reply_markup: { inline_keyboard: buttons },
  });

  return true;
}

async function handleInstallmentPaymentFlow(
  ctx: any,
  txId: string,
  parsed: any,
) {
  // Similar logic untuk installment
}

async function handleAssetTransferFlow(ctx: any, txId: string, parsed: any) {
  // Logic untuk asset transfer
}
```

---

## 🔴 ISSUE #5: Pocket Name vs ID Inconsistency

### Problem Statement

Throughout the codebase, pocket reference mixing:

```typescript
// buttons.ts
callback_data: `p:${txId}:${p.name}`  // ← Using pocket.name (string)

// transactionCallback.ts
const selectedPocket = parts[2];  // Will be string
const pocketData = await getPocketByName(selectedPocket);  // OK but fragile

// pendingTransactions.ts
- Uses pocket name
- But callbacks expect ID sometimes
```

### Root Cause

No consistent ID system. Pocket can be referenced by:

- `name` (snake_case system name)
- `id` (database bigint)
- `display_name` (user-facing name)

### Recomendation Fix

**Normalize to use pocket ID everywhere:**

```typescript
// Step 1: Update getPocketButtons to use ID
export async function getPocketButtons(txId: string): Promise<Array<...>> {
    const { data: pockets } = await supabase
        .from('pockets')
        .select('id, display_name, ownership')
        .order('created_at');

    return pockets.map(p => [
        {
            text: `${getPocketIcon(p.ownership)} ${p.display_name}`,
            callback_data: `p:${txId}:${p.id}`  // Use ID not name
        }
    ]);
}

// Step 2: Update transactionCallback to handle ID
export async function handleTransactionCallback(ctx: any, callbackData: string) {
    const [, txId, pocketId] = callbackData.split(':');
    const pocketIdNum = Number(pocketId);

    // Fetch by ID instead of name (faster, safer)
    const { data: pocketData } = await supabase
        .from('pockets')
        .select('*')
        .eq('id', pocketIdNum)
        .single();

    if (!pocketData) {
        await ctx.answerCbQuery('❌ Kantong tidak valid');
        return;
    }

    // Continue with pocketData...
}
```

---

## ✅ IMPLEMENTATION ROADMAP (Priority)

| Priority | Issue                         | Effort | Impact                       | Status      |
| -------- | ----------------------------- | ------ | ---------------------------- | ----------- |
| 🔴 P1    | Asset Linking Fix             | Medium | HIGH - Core deduction logic  | Not Started |
| 🔴 P1    | OCR Bill/Installment Support  | High   | HIGH - Major missing feature | Not Started |
| 🔴 P1    | Help Command Fix              | Low    | MEDIUM - Credibility         | Not Started |
| 🟡 P2    | AI Parser Enhancement         | High   | HIGH - Better detection      | Not Started |
| 🟡 P2    | Pocket ID Normalization       | Medium | MEDIUM - Code quality        | Not Started |
| 🟢 P3    | Receipt Type Detector Service | High   | MEDIUM - Scalability         | Not Started |

---

## 📝 CRITICAL CHECKLIST BEFORE IMPLEMENTATION

Before implementing any fix:

- [ ] Database schema verified (pockets have valid asset_id)
- [ ] All pocket names standardized (snake_case)
- [ ] Test data seeded correctly
- [ ] API endpoints tested individually
- [ ] Handler routing verified (callbacks reach correct files)
- [ ] Error cases handled gracefully
- [ ] AI responses validated (no "ASK_USER" without handling)
- [ ] OCR flows tested with real receipts (bills, purchases, installments)

---

## 🚀 NEXT STEPS

1. **Confirm Database State** - Verify pockets have asset_id
2. **Implement Issue #1** - Asset Linking & Pocket ID Fix
3. **Implement Issue #3** - Help Command Update
4. **Implement Issue #4** - AI Parser Enhancement
5. **Implement Issue #2** - OCR Bill/Installment Support
6. **Test End-to-End** - All flow scenarios
7. **Monitor & Refine** - Gather user feedback

---

**Document Version:** 1.0  
**Last Updated:** 1 Juni 2026  
**Author:** System Analytics & Architecture Review
