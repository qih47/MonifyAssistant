export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  telegram_id?: string;
  telegram_chat_id?: string;
  color?: string;
}

export interface TelegramConfig {
  enabled: boolean;
  bot_token?: string;
  bot_username?: string;
}

export interface AppSettings {
  id?: string;
  household_name: string;
  currency: string;
  low_fund_threshold: number;
  partner_enabled: boolean;
  member_1: FamilyMember;
  member_2: FamilyMember;
  telegram_config: TelegramConfig;
  updated_at?: string;
}

export interface ChatMessageRequest {
  message?: string;
  imageBase64?: string;
  mimeType?: string;
  actorId?: string;
  actorName?: string;
}

export interface TransactionProposalDraft {
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
  available_pockets: Array<{
    id: number;
    name: string;
    display_name: string;
    balance: number;
  }>;
}

export interface ChatAssistantResponse {
  id: string;
  reply: string;
  type: 'text' | 'transaction_proposal' | 'balance_info';
  data?: {
    transactionDraft?: TransactionProposalDraft;
    balanceData?: any;
  };
}

// 1. Ambil Pengaturan
export async function fetchAppSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE_URL}/api/settings`);
  if (!res.ok) throw new Error('Gagal memuat pengaturan');
  const json = await res.json();
  return json.data;
}

// 2. Simpan Pengaturan
export async function saveAppSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const res = await fetch(`${API_BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menyimpan pengaturan');
  return json.data;
}

// 3. Tes Notifikasi Telegram
export async function testTelegram(payload: { bot_token: string; chat_id: string; member_name?: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/settings/test-telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengetes Telegram');
}

// 4. Kirim Pesan / Foto ke In-App Chatbot
export async function sendInAppChatMessage(payload: ChatMessageRequest): Promise<ChatAssistantResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengirim pesan chat');
  return json.data;
}

// 5. Konfirmasi Transaksi dari Chatbot
export async function confirmChatTransaction(draftId: string, pocketId: number) {
  const res = await fetch(`${API_BASE_URL}/api/chat/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId, pocketId })
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengonfirmasi transaksi');
  return json;
}

// 6. Batalkan Transaksi dari Chatbot
export async function cancelChatTransaction(draftId: string) {
  const res = await fetch(`${API_BASE_URL}/api/chat/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId })
  });
  return res.json();
}
