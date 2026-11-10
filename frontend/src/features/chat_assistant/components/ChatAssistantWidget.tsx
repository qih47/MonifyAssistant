import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  Image as ImageIcon, 
  Check, 
  AlertCircle, 
  ArrowRight,
  Maximize2,
  Minimize2,
  ChevronDown,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { useFamily } from '../../../context/FamilyContext';
import { 
  sendInAppChatMessage, 
  confirmChatTransaction, 
  cancelChatTransaction
} from '../../../config/api';
import type { TransactionProposalDraft } from '../../../config/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actorName?: string;
  actorRole?: string;
  draft?: TransactionProposalDraft;
  status?: 'pending' | 'confirmed' | 'cancelled';
  confirmationResult?: string;
}

export const ChatAssistantWidget: React.FC = () => {
  const { member1, member2, householdName, partnerEnabled, activeChatActor, setActiveChatActor, getActorLabel } = useFamily();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedPockets, setSelectedPockets] = useState<Record<string, number>>({});
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMember = activeChatActor === 'member_1' ? member1 : member2;

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          text: `Halo ${activeMember.name}! 👋 Saya Moni, asisten keuangan keluarga untuk ${householdName}.\n\nKamu bisa mengetik transaksi santai (contoh: *"Beli makan 35rb"*), tanya saldo (*"Cek saldo"*), atau upload foto struk belanja di sini! 📸`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [householdName, activeMember.name]);

  const handleSendText = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    const userMsgId = 'user_' + Date.now();
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      actorName: activeMember.name,
      actorRole: activeMember.role,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsLoading(true);

    try {
      const response = await sendInAppChatMessage({
        message: text,
        actorId: activeChatActor,
        actorName: activeMember.name
      });

      const botMsg: ChatMessage = {
        id: response.id || 'bot_' + Date.now(),
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        draft: response.data?.transactionDraft,
        status: response.data?.transactionDraft ? 'pending' : undefined
      };

      if (response.data?.transactionDraft) {
        const defaultPocket = response.data.transactionDraft.suggested_pocket_id || 
                              response.data.transactionDraft.available_pockets[0]?.id;
        if (defaultPocket) {
          setSelectedPockets((prev) => ({
            ...prev,
            [response.data!.transactionDraft!.draftId]: defaultPocket
          }));
        }
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: `⚠️ Maaf, ada kendala koneksi ke server: ${err.message || 'Gagal memproses pesan.'}`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      const mimeType = file.type || 'image/jpeg';

      const userMsgId = 'user_img_' + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          sender: 'user',
          text: `📷 [Mengunggah struk/dokumen: ${file.name}]`,
          actorName: activeMember.name,
          actorRole: activeMember.role,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      setIsLoading(true);

      try {
        const response = await sendInAppChatMessage({
          imageBase64: base64Data,
          mimeType,
          actorId: activeChatActor,
          actorName: activeMember.name
        });

        const botMsg: ChatMessage = {
          id: response.id || 'bot_' + Date.now(),
          sender: 'assistant',
          text: response.reply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          draft: response.data?.transactionDraft,
          status: response.data?.transactionDraft ? 'pending' : undefined
        };

        if (response.data?.transactionDraft) {
          const defaultPocket = response.data.transactionDraft.suggested_pocket_id || 
                                response.data.transactionDraft.available_pockets[0]?.id;
          if (defaultPocket) {
            setSelectedPockets((prev) => ({
              ...prev,
              [response.data!.transactionDraft!.draftId]: defaultPocket
            }));
          }
        }

        setMessages((prev) => [...prev, botMsg]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'err_' + Date.now(),
            sender: 'assistant',
            text: `⚠️ Maaf, gagal membaca dokumen: ${err.message || 'Coba periksa format foto.'}`,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmTransaction = async (msgId: string, draftId: string) => {
    const pocketId = selectedPockets[draftId];
    if (!pocketId) return;

    try {
      setProcessingDraftId(draftId);
      const res = await confirmChatTransaction(draftId, pocketId);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === msgId
            ? { ...msg, status: 'confirmed', confirmationResult: res.message }
            : msg
        )
      );
    } catch (err: any) {
      alert(`Gagal menyimpan transaksi: ${err.message}`);
    } finally {
      setProcessingDraftId(null);
    }
  };

  const handleCancelTransaction = async (msgId: string, draftId: string) => {
    try {
      setProcessingDraftId(draftId);
      await cancelChatTransaction(draftId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === msgId
            ? { ...msg, status: 'cancelled', confirmationResult: 'Transaksi dibatalkan.' }
            : msg
        )
      );
    } catch {
      // Ignore
    } finally {
      setProcessingDraftId(null);
    }
  };

  return (
    <>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Floating Action Button (Right Bottom) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group border border-zinc-700/50 dark:border-zinc-200"
          aria-label="Buka Asisten Keuangan"
        >
          <div className="relative">
            <Bot size={22} className="group-hover:rotate-12 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-zinc-900 dark:ring-white animate-pulse" />
          </div>
          <span className="text-xs font-semibold tracking-wide">Moni Assistant</span>
        </button>
      )}

      {/* Modern Minimalist Chat Drawer / Modal */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[85vh] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200/90 dark:border-zinc-800/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300 font-sans">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-50/80 dark:bg-zinc-950/80 border-b border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-sm">
                <Bot size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Moni AI</h3>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                  {householdName}
                </p>
              </div>
            </div>

            {/* Switch Actor Pill */}
            <div className="flex items-center gap-2">
              {partnerEnabled && (
                <button
                  onClick={() =>
                    setActiveChatActor(activeChatActor === 'member_1' ? 'member_2' : 'member_1')
                  }
                  title="Ganti pengguna yang mencatat"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-200/70 hover:bg-zinc-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  <span>{activeChatActor === 'member_1' ? '🧑' : '👩'}</span>
                  <span className="max-w-[80px] truncate">{activeMember.name}</span>
                  <ChevronDown size={12} className="opacity-60" />
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Sender badge for user */}
                {msg.sender === 'user' && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1 mr-1">
                    {msg.actorName} ({msg.actorRole}) • {msg.timestamp}
                  </span>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-xs shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200 rounded-tl-xs border border-zinc-200/60 dark:border-zinc-700/50'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Interactive Transaction Proposal Card */}
                  {msg.draft && msg.status === 'pending' && (
                    <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3 text-zinc-900 dark:text-zinc-100 shadow-sm">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {msg.draft.type === 'expense' ? '🔴 Pengeluaran' : msg.draft.type === 'income' ? '🟢 Pemasukan' : '🔵 Transfer'}
                        </span>
                        <span className="text-[10px] text-zinc-400">{msg.draft.merchant || 'Umum'}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-zinc-400 block">Total Nominal:</span>
                        <span className="text-base font-extrabold font-mono tracking-tight text-zinc-900 dark:text-zinc-50">
                          {msg.draft.formatted_amount}
                        </span>
                      </div>

                      {/* Select Pocket Dropdown */}
                      <div>
                        <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                          Pilih Kantong Anggaran:
                        </label>
                        <select
                          value={selectedPockets[msg.draft.draftId] || msg.draft.suggested_pocket_id}
                          onChange={(e) =>
                            setSelectedPockets({
                              ...selectedPockets,
                              [msg.draft!.draftId]: Number(e.target.value)
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                        >
                          {msg.draft.available_pockets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name} (Rp {p.balance.toLocaleString('id-ID')})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Confirmation Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleConfirmTransaction(msg.id, msg.draft!.draftId)}
                          disabled={processingDraftId === msg.draft.draftId}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
                        >
                          {processingDraftId === msg.draft.draftId ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          <span>Konfirmasi Simpan</span>
                        </button>

                        <button
                          onClick={() => handleCancelTransaction(msg.id, msg.draft!.draftId)}
                          disabled={processingDraftId === msg.draft.draftId}
                          className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold text-xs transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirmed State Notice */}
                  {msg.status === 'confirmed' && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <Check size={14} className="text-emerald-600 shrink-0" />
                      <span>{msg.confirmationResult || 'Transaksi telah berhasil dicatat!'}</span>
                    </div>
                  )}

                  {/* Cancelled State Notice */}
                  {msg.status === 'cancelled' && (
                    <div className="mt-2.5 p-2 rounded-lg bg-zinc-200/50 dark:bg-zinc-800/50 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Draft transaksi ini telah dibatalkan.
                    </div>
                  )}
                </div>

                {msg.sender === 'assistant' && (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 ml-1">
                    {msg.timestamp}
                  </span>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 text-xs py-2 px-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-150" />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-300" />
                <span className="text-[11px] font-medium ml-1">Moni sedang berpikir...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto bg-zinc-50/50 dark:bg-zinc-950/40 border-t border-zinc-100 dark:border-zinc-800/60 no-scrollbar">
            {['Cek Saldo', 'Ringkasan', 'Beli Kopi 35rb'].map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendText(prompt)}
                disabled={isLoading}
                className="shrink-0 px-3 py-1 rounded-full text-[10px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box Footer */}
          <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendText();
              }}
              className="flex items-center gap-2"
            >
              {/* Photo Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Unggah Foto Struk Belanja"
                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
              >
                <ImageIcon size={18} />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Catat sebagai ${activeMember.name}...`}
                disabled={isLoading}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 disabled:opacity-40 transition-all shadow-sm"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistantWidget;
