# 🔧 PRIORITAS IMPLEMENTASI FIXES - MONIFY SYSTEM

**Status:** Ready for Implementation  
**Created:** Session 2 - Deep System Analysis

---

## ✅ WHAT'S ALREADY WORKING

### Asset Linking Infrastructure ✓

- **Bill Payment Handler** (`billPaymentCallback.ts`): ✅ Deducts from both pocket AND asset
- **Installment Handler** (`installmentCallback.ts`): ✅ Deducts from both pocket AND asset
- **Saving Goal Handler** (`savingGoalCallback.ts`): ✅ Deducts from both pocket AND asset
- **Asset Transfer Handler** (`assetTransferCallback.ts`): ✅ Transfers between assets correctly
- **Transaction Handler** (`transactionCallback.ts`): ✅ Deducts from both pocket AND asset

**Key Functions:**

- `getPocketByName()` & `getPocketById()` ✓ Both exist
- `getAssetById()` & `updateAssetBalance()` ✓ Both exist
- `updatePocketCurrentBalance()` ✓ Works correctly
- Pocket has `asset_id` field ✓ Verified in all callbacks

### OCR Integration ✓

- `handlePhotoMessage()` successfully:
  - Calls `parseFinancialImage()` to extract data
  - Calls `getPocketButtons(txId)` to generate confirmation UI
  - Stores in `pendingTransactions` Map
  - Callbacks route correctly via prefix: `p:txId:pocketName`

---

## 🔴 ACTUAL ISSUES THAT NEED FIXING

### 1️⃣ **ISSUE: OCR Hardcoded as "Pengeluaran" Only**

**Location:** `receiptHandler.ts` line 40

```typescript
// CURRENT (WRONG):
`🔴 Tipe: *Pengeluaran*\n` +  // ← Always hardcoded!
```

**Impact:**

- Users think ALL receipts are expenses
- Cannot process bills, paylater, or installments via OCR
- AI already detects type correctly, but it's ignored

**Fix Required:** Use parsed `type` field from AI response

```typescript
// RECOMMENDED:
const typeEmoji = hasilParse.type === 'income' ? '🟢' : hasilParse.type === 'transfer' ? '🔵' : '🔴';
const typeLabel = hasilParse.type === 'income' ? 'Pemasukan' : hasilParse.type === 'transfer' ? 'Transfer' : 'Pengeluaran';
`${typeEmoji} Tipe: *${typeLabel}*\n` +
```

---

### 2️⃣ **ISSUE: Help Command Advertises "cek budget" That Doesn't Exist**

**Location:** `commands.ts` line 29

```typescript
// CURRENT (WRONG):
• 📉 *Alokasi Budget:* `cek budget bulan ini` ← ❌ NO HANDLER EXISTS
```

**Impact:** Users confused, credibility damaged

**Fix Required:** Remove non-existent feature, add actual implemented features

---

### 3️⃣ **ISSUE: AI Parser Returns "ASK_USER" That Handlers Don't Process**

**Location:** `aiService.ts` system prompt (lines 21-55)

```typescript
// Current: allocated_pocket can be "ASK_USER"
// But handlers don't have logic to ask user

// When "ASK_USER" is returned, system falls back to getPocketButtons()
// which asks user anyway - so workaround exists, but suboptimal
```

**Impact:**

- Unnecessary complexity
- AI parsing not fully utilized
- No transaction_subtype field for bills/installments/paylater

**Fix Required:** Add `transaction_subtype` field to AI response schema

---

### 4️⃣ **ISSUE: No Receipt Type Detection for Bill/Paylater/Installment**

**Location:** `aiService.ts` system prompt doesn't guide receipt analysis

**Impact:**

- OCR shows all receipts as "Belanja", not recognizing bills
- No way to match bill payment receipts to bills entity
- Cannot distinguish "Bayar GCash" from "Beli di Indomaret"

**Fix Required:** Enhance AI prompt + add receipt analyzer

---

## 🚀 IMPLEMENTATION PLAN (By Priority)

### **PRIORITY 1: Fix OCR Type Display** ⏱️ 15 min

**File:** `handlers/photo/receiptHandler.ts` line 40

**Change:**

```typescript
// Replace hardcoded line:
`🔴 Tipe: *Pengeluaran*\n` +

// With dynamic type from AI:
const typeEmoji = hasilParse.type === 'income' ? '🟢' :
                  hasilParse.type === 'transfer' ? '🔵' : '🔴';
const typeLabel = hasilParse.type === 'income' ? 'Pemasukan' :
                  hasilParse.type === 'transfer' ? 'Transfer' : 'Pengeluaran';

// Then insert:
`${typeEmoji} Tipe: *${typeLabel}*\n` +
```

**Verification:**

- OCR receipt shows "🟢 Pemasukan" if AI detected income
- OCR receipt shows "🔵 Transfer" if AI detected transfer
- OCR receipt shows "🔴 Pengeluaran" for expenses

---

### **PRIORITY 2: Fix Help Command** ⏱️ 10 min

**File:** `commands.ts` line 24-35

**Change:**

- Remove: "📉 _Alokasi Budget:_ `cek budget bulan ini`"
- Add: Actual implemented features only
- Cross-reference with `messageHandlers.ts` keywords

**Verified Implemented Features:**

- ✅ `/saldo` - Cek Saldo
- ✅ `/ringkasan` - Ringkasan Bulanan
- ✅ `/bayar` - Bayar Tagihan
- ✅ `/cicil` - Bayar Cicilan
- ✅ `/laporan` - Export CSV
- ✅ Catat Transaksi (natural text or OCR)
- ✅ Nabung/Tabungan
- ✅ Transfer Antar Asset

**NOT Verified:**

- ❌ "cek budget bulan ini" - No handler found
- ❌ "Alokasi Budget" - No command exists

---

### **PRIORITY 3: Enhance AI Parser with transaction_subtype** ⏱️ 30 min

**File:** `services/aiService.ts` system instruction

**Changes:**

1. Add `transaction_subtype` field to JSON schema
2. Add rules to detect: purchase | bill_payment | installment_payment | paylater_payment | saving_goal | asset_transfer
3. Update response parsing to include new field

**Benefits:**

- Handlers can route correctly
- OCR can detect bills/paylater/installments
- Cleaner separation of concerns

---

### **PRIORITY 4: Add Receipt Type Detector** ⏱️ 45 min

**New File:** `services/receiptAnalyzer.ts`

```typescript
export async function detectReceiptType(
  description: string,
  imageBuffer?: Buffer,
): Promise<
  "purchase" | "bill" | "paylater" | "installment" | "transfer" | "unknown"
> {
  // Pattern matching in description
  if (/listrik|wifi|pln|tagihan|air|gas/i.test(description)) return "bill";
  if (/gcash|paylater|kredivo|akulaku|bayar paylater/i.test(description))
    return "paylater";
  if (/cicilan|tenor|bayar cicilan/i.test(description)) return "installment";
  if (/transfer|pindah|ke (gopay|mandiri|bca)/i.test(description))
    return "transfer";

  // If imageBuffer provided, use Gemini Vision for deeper analysis
  // (For future enhancement)

  return "unknown";
}
```

---

### **PRIORITY 5: Update OCR Handler for Bill/Paylater Detection** ⏱️ 20 min

**File:** `handlers/photo/receiptHandler.ts` line 20-40

**Enhancement:**

```typescript
// After parseFinancialImage call:
const receiptType = detectReceiptType(hasilParse.description, imageBuffer);

// Store receipt type info:
pendingTransactions.set(txId, {
    ...,
    receipt_type: receiptType  // NEW
});

// Show type-appropriate message:
if (receiptType === 'bill') {
    // Show bill payment prompt instead of regular purchase
} else if (receiptType === 'paylater') {
    // Show paylater payment prompt
}
```

---

### **PRIORITY 6: Improve Pocket ID Consistency** ⏱️ 30 min

**Current:** Pocket referenced by `.name` (string)  
**Issue:** Fragile, database queries inefficient

**Fix:** Optional - Can use ID instead, but works okay with name currently

```typescript
// Current (works):
callback_data: `p:${txId}:${p.name}`;

// Could be improved to:
callback_data: `p:${txId}:${p.id}`;

// Then in callback:
const pocketData = await getPocketById(Number(pocketId));
```

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] **PRIORITY 1**: Fix OCR type display (15 min)
  - [ ] Update receiptHandler.ts line 40
  - [ ] Test with OCR image (expense)
  - [ ] Test with different transaction types

- [ ] **PRIORITY 2**: Fix help command (10 min)
  - [ ] Update commands.ts
  - [ ] Remove "cek budget" reference
  - [ ] Add OCR mention

- [ ] **PRIORITY 3**: Add transaction_subtype to AI (30 min)
  - [ ] Update system instruction in aiService.ts
  - [ ] Add field to response schema
  - [ ] Update response parsing
  - [ ] Test Groq response parsing

- [ ] **PRIORITY 4**: Create receiptAnalyzer.ts (45 min)
  - [ ] Write pattern matching logic
  - [ ] Add to aiService.ts imports
  - [ ] Create unit tests

- [ ] **PRIORITY 5**: Update OCR handler (20 min)
  - [ ] Import receiptAnalyzer
  - [ ] Call detectReceiptType
  - [ ] Store receipt_type in pendingTransactions

- [ ] **PRIORITY 6**: Optional - Use pocket ID (30 min)
  - [ ] Update buttons.ts callback format
  - [ ] Update transactionCallback.ts parsing
  - [ ] Test all callback flows

---

## 🎯 TESTING STRATEGY

### After PRIORITY 1 (OCR Type Fix):

```
Test Cases:
1. Upload OCR with "Bayar Listrik 250rb" → Should show 🔴 Pengeluaran (or detect type)
2. Upload OCR with "Gaji masuk 8jt" → Should show 🟢 Pemasukan
3. Upload OCR with "Transfer ke GoPay 100rb" → Should show 🔵 Transfer
```

### After PRIORITY 2 (Help Fix):

```
/help → Should NOT mention "cek budget"
/help → Should mention OCR, Bill, Installment features that exist
```

### After PRIORITY 3 & 4 (AI + Receipt Analyzer):

```
AI Response for "Bayar listrik 250rb":
{
    "transaction_subtype": "bill_payment",
    "allocated_pocket": "listrik_dan_pulsa",
    ...
}

detectReceiptType("Bayar Listrik PLN") → returns 'bill'
```

---

## ⚠️ CRITICAL NOTES

1. **No Breaking Changes**: All fixes are additive or replacements of hardcoded values
2. **Backward Compatible**: Existing callback format works as-is
3. **Asset Linking Already Works**: Just need to expose parsed type info
4. **No Database Changes**: Schema supports all needed fields already

---

## 🔄 ROLLBACK PLAN

If any fix breaks functionality:

1. Revert to previous version from git
2. All changes are isolated (no cascade effects)
3. Test suite should catch issues before deployment

---

**Ready to Start Implementation:** YES ✅  
**Estimated Total Time:** 2.5 hours (if done sequentially)  
**Risk Level:** LOW (additive changes, no schema modifications)
