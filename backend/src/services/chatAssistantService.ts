import crypto from 'crypto';
import { supabase } from '../config/supabaseClient.js';
import { parseFinancialText, parseFinancialImage, queryWithAIContext } from './aiService.js';
import { getPocketById, updatePocketCurrentBalance } from './pocketService.js';
import { getAssetById, updateAssetBalance } from './assetService.js';
import { createTransaction } from './transactionService.js';
import { checkAndNotifyLowFund } from './lowFundService.js';
import { sendTransactionEmailNotification } from './notificationService.js';
import { formatIDR } from '../helpers/formatters.js';
import { getSettings } from './settingsService.js';

// Penyimpanan draft sementara in-memory untuk konfirmasi via REST API
interface PendingDraft {
  draftId: string;
  amount: number;
  description: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  merchant: string;
  actor: 'suami' | 'istri';
  actor_name: string;
  suggested_pocket_id?: number;
  transaction_subtype?: string;
  created_at: number;
}

const pendingDrafts = new Map<string, PendingDraft>();

// Bersihkan draft yang expired (> 30 menit)
setInterval(() => {
  const now = Date.now();
  for (const [key, draft] of pendingDrafts.entries()) {
    if (now - draft.created_at > 30 * 60 * 1000) {
      pendingDrafts.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface ProcessMessageInput {
  message?: string;
  imageBase64?: string;
  mimeType?: string;
  actorId?: string; // 'member_1' | 'member_2' atau 'suami' | 'istri'
  actorName?: string;
}

export interface ChatAssistantResponse {
  id: string;
  reply: string;
  type: 'text' | 'transaction_proposal' | 'balance_info';
  data?: {
    transactionDraft?: {
      draftId: string;
      amount: number;
      formatted_amount: string;
      description: string;
      type: 'income' | 'expense' | 'transfer';
      category: string;
      merchant: string;
      actor: string;
      actor_name: string;
      suggested_pocket_id?: number;
      available_pockets: Array<{ id: number; name: string; display_name: string; balance: number }>;
    };
    balanceData?: any;
  };
}

/**
 * Memproses pesan teks atau gambar struk dari In-App Chatbot (Web / Android)
 */
export async function processInAppChatMessage(input: ProcessMessageInput): Promise<ChatAssistantResponse> {
  const settings = await getSettings();
  const msgId = crypto.randomUUID();

  // Tentukan Aktor & Nama Pengirim
  let actorKey: 'suami' | 'istri' = 'suami';
  let displayName = settings.member_1.name;

  if (input.actorId === 'member_2' || input.actorId === 'istri') {
    actorKey = 'istri';
    displayName = settings.member_2.name;
  } else if (input.actorId === 'member_1' || input.actorId === 'suami') {
    actorKey = 'suami';
    displayName = settings.member_1.name;
  } else if (input.actorName) {
    if (input.actorName.toLowerCase() === settings.member_2.name.toLowerCase()) {
      actorKey = 'istri';
      displayName = settings.member_2.name;
    }
  }

  // 1. JIKA USER MENGUNGGAH GAMBAR / STRUK BELANJA
  if (input.imageBase64) {
    const buffer = Buffer.from(input.imageBase64, 'base64');
    const mime = input.mimeType || 'image/jpeg';
    const parsedImage = await parseFinancialImage(buffer, mime);

    if (!parsedImage || !parsedImage.amount) {
      return {
        id: msgId,
        reply: `Maaf ${displayName}, Moni gagal membaca detail nominal dari dokumen/struk ini. Pastikan foto jelas dan coba lagi ya! 📸`,
        type: 'text'
      };
    }

    const { data: pockets } = await supabase.from('pockets').select('id, name, display_name, current_balance');
    const pocketList = pockets || [];
    
    // Cari pocket yang cocok
    let matchedPocket = pocketList.find(p => 
      p.name.toLowerCase() === (parsedImage.allocated_pocket || '').toLowerCase()
    );
    if (!matchedPocket && pocketList.length > 0) {
      matchedPocket = pocketList[0];
    }

    const draftId = 'draft_' + crypto.randomBytes(6).toString('hex');
    pendingDrafts.set(draftId, {
      draftId,
      amount: Number(parsedImage.amount),
      description: parsedImage.description || 'Transaksi Struk',
      type: parsedImage.type || 'expense',
      category: parsedImage.category || 'lainnya',
      merchant: parsedImage.merchant || 'Umum',
      actor: actorKey,
      actor_name: displayName,
      suggested_pocket_id: matchedPocket?.id,
      transaction_subtype: parsedImage.transaction_subtype,
      created_at: Date.now()
    });

    return {
      id: msgId,
      reply: `Moni berhasil membaca struk dari *${parsedImage.merchant || 'Merchant'}* sebesar *${formatIDR(Number(parsedImage.amount))}*! Mohon konfirmasi kantong dan simpan transaksi ini:`,
      type: 'transaction_proposal',
      data: {
        transactionDraft: {
          draftId,
          amount: Number(parsedImage.amount),
          formatted_amount: formatIDR(Number(parsedImage.amount)),
          description: parsedImage.description || 'Transaksi Struk',
          type: parsedImage.type || 'expense',
          category: parsedImage.category || 'lainnya',
          merchant: parsedImage.merchant || 'Umum',
          actor: actorKey,
          actor_name: displayName,
          suggested_pocket_id: matchedPocket?.id,
          available_pockets: pocketList.map(p => ({
            id: p.id,
            name: p.name,
            display_name: p.display_name || p.name,
            balance: Number(p.current_balance || 0)
          }))
        }
      }
    };
  }

  // 2. JIKA USER MENGIRIM PESAN TEKS
  const userText = (input.message || '').trim();
  if (!userText) {
    return {
      id: msgId,
      reply: `Halo ${displayName}! Ada yang bisa Moni bantu catat hari ini? Ketik pengeluaran santai atau tanya saldo ya! 💡`,
      type: 'text'
    };
  }

  // Cek apakah ini pertanyaan saldo / rekap informasi
  const lowerText = userText.toLowerCase();
  const isBalanceQuery = ['saldo', 'uang', 'rekap', 'ringkasan', 'cek saldo', 'total uang'].some(k => lowerText.includes(k));

  if (isBalanceQuery && !userText.match(/\d+/)) {
    const [pocketsRes, assetsRes] = await Promise.all([
      supabase.from('pockets').select('id, name, display_name, current_balance'),
      supabase.from('assets').select('id, name, balance, category')
    ]);

    const pockets = pocketsRes.data || [];
    const assets = assetsRes.data || [];

    const totalPocket = pockets.reduce((acc, p) => acc + Number(p.current_balance || 0), 0);
    const totalAsset = assets.reduce((acc, a) => acc + Number(a.balance || 0), 0);

    const pocketDetails = pockets.map(p => `• *${p.display_name || p.name}*: ${formatIDR(Number(p.current_balance))}`).join('\n');

    return {
      id: msgId,
      reply: `📊 *Status Keuangan ${settings.household_name}*\n\n` +
             `💰 *Total di Kantong Anggaran:* ${formatIDR(totalPocket)}\n` +
             `🏦 *Total di Rekening & Aset:* ${formatIDR(totalAsset)}\n\n` +
             `*Rincian Kantong:*\n${pocketDetails}`,
      type: 'balance_info',
      data: {
        balanceData: { totalPocket, totalAsset, pockets, assets }
      }
    };
  }

  // 3. JIKA PERNYATAAN BERSERTA NOMINAL (TRANSAKSI BARU)
  const hasNumber = /\d+/.test(userText);
  if (hasNumber) {
    const parsed = await parseFinancialText(userText);
    if (parsed) {
      parsed.actor = actorKey;
    }

    if (parsed && parsed.amount && parsed.amount > 0) {
      const { data: pockets } = await supabase.from('pockets').select('id, name, display_name, current_balance');
      const pocketList = pockets || [];

      let matchedPocket = pocketList.find(p => 
        p.name.toLowerCase() === (parsed.allocated_pocket || '').toLowerCase()
      );
      if (!matchedPocket && pocketList.length > 0) {
        matchedPocket = pocketList[0];
      }

      const draftId = 'draft_' + crypto.randomBytes(6).toString('hex');
      pendingDrafts.set(draftId, {
        draftId,
        amount: Number(parsed.amount),
        description: parsed.description || userText,
        type: parsed.type || 'expense',
        category: parsed.category || 'lainnya',
        merchant: parsed.merchant || 'Umum',
        actor: actorKey,
        actor_name: displayName,
        suggested_pocket_id: matchedPocket?.id,
        transaction_subtype: parsed.transaction_subtype,
        created_at: Date.now()
      });

      const typeLabel = parsed.type === 'income' ? 'Pemasukan' : parsed.type === 'transfer' ? 'Transfer' : 'Pengeluaran';

      return {
        id: msgId,
        reply: `Catatan ${typeLabel} sebesar *${formatIDR(Number(parsed.amount))}* untuk *"${parsed.description}"* sudah disiapkan. Konfirmasi untuk menyimpan ke anggaran:`,
        type: 'transaction_proposal',
        data: {
          transactionDraft: {
            draftId,
            amount: Number(parsed.amount),
            formatted_amount: formatIDR(Number(parsed.amount)),
            description: parsed.description || userText,
            type: parsed.type || 'expense',
            category: parsed.category || 'lainnya',
            merchant: parsed.merchant || 'Umum',
            actor: actorKey,
            actor_name: displayName,
            suggested_pocket_id: matchedPocket?.id,
            available_pockets: pocketList.map(p => ({
              id: p.id,
              name: p.name,
              display_name: p.display_name || p.name,
              balance: Number(p.current_balance || 0)
            }))
          }
        }
      };
    }
  }

  // 4. GENERAL AI CONVERSATION FALLBACK
  const aiAnswer = await queryWithAIContext(userText, displayName);
  return {
    id: msgId,
    reply: aiAnswer,
    type: 'text'
  };
}

/**
 * Mengeksekusi konfirmasi transaksi draft dari In-App Chatbot
 */
export async function confirmInAppTransaction(draftId: string, pocketId: number) {
  const draft = pendingDrafts.get(draftId);
  if (!draft) {
    throw new Error('Draft transaksi tidak ditemukan atau sudah kadaluarsa.');
  }

  pendingDrafts.delete(draftId);

  const pocketData = await getPocketById(Number(pocketId));
  const finalPocketId = pocketData?.id || 1;
  const linkedAssetId = pocketData?.asset_id;
  const transactionType = draft.type || 'expense';
  const modifier = transactionType === 'expense' ? -1 : 1;

  // 1. Simpan Transaksi di Supabase
  const txRecord = await createTransaction({
    amount: draft.amount,
    description: draft.description,
    type: transactionType,
    pocket_id: finalPocketId,
    asset_id: linkedAssetId || 1,
    actor: draft.actor,
    category: draft.category || 'lainnya',
    merchant: draft.merchant || 'umum',
    created_at: new Date().toISOString()
  });

  // 2. Potong / Tambah Saldo Pocket
  let newPocketBalance = Number(pocketData?.current_balance || 0) + (draft.amount * modifier);
  if (pocketData) {
    await updatePocketCurrentBalance(finalPocketId, newPocketBalance);
  }

  // 3. Sinkronisasi Saldo Aset Terkait
  if (linkedAssetId) {
    const assetData = await getAssetById(linkedAssetId);
    if (assetData) {
      await updateAssetBalance(linkedAssetId, Number(assetData.balance) + (draft.amount * modifier));
    }
  }

  // 4. Low Fund Check & Email Notification (Background async)
  checkAndNotifyLowFund().catch(err => console.error('Low fund error:', err));
  sendTransactionEmailNotification({
    amount: draft.amount,
    description: draft.description,
    type: transactionType,
    pocket_name: pocketData?.name || 'Umum',
    actor: draft.actor
  }).catch(err => console.error('Email notification error:', err));

  return {
    success: true,
    message: `✅ Berhasil dicatat! ${transactionType === 'expense' ? 'Pengeluaran' : 'Pemasukan'} ${formatIDR(draft.amount)} dari kantong "${pocketData?.display_name || pocketData?.name}". Sisa saldo: ${formatIDR(newPocketBalance)}`,
    transaction: txRecord,
    updated_pocket: {
      id: finalPocketId,
      name: pocketData?.name,
      new_balance: newPocketBalance
    }
  };
}

/**
 * Membatalkan draft transaksi
 */
export function cancelInAppTransaction(draftId: string) {
  if (pendingDrafts.has(draftId)) {
    pendingDrafts.delete(draftId);
    return { success: true, message: 'Transaksi berhasil dibatalkan.' };
  }
  return { success: false, message: 'Draft tidak ditemukan.' };
}
