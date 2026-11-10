import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Send, 
  Sliders, 
  Save, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Bot
} from 'lucide-react';
import { useFamily } from '../../../context/FamilyContext';
import { testTelegram } from '../../../config/api';

export const SettingsPage: React.FC = () => {
  const { settings, isLoading, updateSettings } = useFamily();

  // Local Form State
  const [householdName, setHouseholdName] = useState('');
  const [currency, setCurrency] = useState('IDR');
  const [lowFundThreshold, setLowFundThreshold] = useState<number>(100000);

  // Member 1
  const [m1Name, setM1Name] = useState('');
  const [m1Role, setM1Role] = useState('Suami');
  const [m1Telegram, setM1Telegram] = useState('');
  const [m1Color, setM1Color] = useState('emerald');

  // Member 2
  const [m2Name, setM2Name] = useState('');
  const [m2Role, setM2Role] = useState('Istri');
  const [m2Telegram, setM2Telegram] = useState('');
  const [m2Color, setM2Color] = useState('violet');

  // Partner Toggle
  const [partnerEnabled, setPartnerEnabled] = useState(false);

  // Telegram Config
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgBotUsername, setTgBotUsername] = useState('');
  const [showBotToken, setShowBotToken] = useState(false);

  // Status feedback
  const [activeTab, setActiveTab] = useState<'family' | 'telegram' | 'preferences'>('family');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Test Telegram State
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [testTgStatus, setTestTgStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setHouseholdName(settings.household_name || '');
      setCurrency(settings.currency || 'IDR');
      setLowFundThreshold(settings.low_fund_threshold || 100000);
      setPartnerEnabled(!!settings.partner_enabled);

      setM1Name(settings.member_1?.name || '');
      setM1Role(settings.member_1?.role || 'Suami');
      setM1Telegram(settings.member_1?.telegram_id || '');
      setM1Color(settings.member_1?.color || 'emerald');

      setM2Name(settings.member_2?.name || '');
      setM2Role(settings.member_2?.role || 'Istri');
      setM2Telegram(settings.member_2?.telegram_id || '');
      setM2Color(settings.member_2?.color || 'violet');

      setTgEnabled(!!settings.telegram_config?.enabled);
      setTgBotToken(settings.telegram_config?.bot_token || '');
      setTgBotUsername(settings.telegram_config?.bot_username || '');
    }
  }, [settings]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMessage(null);

      await updateSettings({
        household_name: householdName,
        currency,
        low_fund_threshold: Number(lowFundThreshold),
        partner_enabled: partnerEnabled,
        member_1: {
          id: 'member_1',
          name: m1Name.trim() || 'Partner 1',
          role: m1Role.trim() || 'Suami',
          telegram_id: m1Telegram.trim(),
          telegram_chat_id: m1Telegram.trim(),
          color: m1Color
        },
        member_2: {
          id: 'member_2',
          name: m2Name.trim() || 'Partner 2',
          role: m2Role.trim() || 'Istri',
          telegram_id: m2Telegram.trim(),
          telegram_chat_id: m2Telegram.trim(),
          color: m2Color
        },
        telegram_config: {
          enabled: tgEnabled,
          bot_token: tgBotToken.trim(),
          bot_username: tgBotUsername.trim()
        }
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestTelegram = async (memberIndex: 1 | 2) => {
    const targetChatId = memberIndex === 1 ? m1Telegram : m2Telegram;
    const targetName = memberIndex === 1 ? m1Name : m2Name;

    if (!tgBotToken) {
      setTestTgStatus({ success: false, message: 'Harap isi Bot Token terlebih dahulu.' });
      return;
    }
    if (!targetChatId) {
      setTestTgStatus({ success: false, message: `Harap isi Telegram ID untuk ${targetName || 'anggota'}.` });
      return;
    }

    try {
      setIsTestingTg(true);
      setTestTgStatus(null);
      await testTelegram({
        bot_token: tgBotToken.trim(),
        chat_id: targetChatId.trim(),
        member_name: targetName
      });
      setTestTgStatus({ success: true, message: `Pesan tes berhasil terkirim ke ${targetName}!` });
    } catch (err: any) {
      setTestTgStatus({ success: false, message: err.message || 'Gagal mengirim pesan tes.' });
    } finally {
      setIsTestingTg(false);
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Pengaturan Sistem & Keluarga
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
              Universal Mode
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Konfigurasi nama pasangan, peran dinamis, dan integrasi asisten finansial.
          </p>
        </div>

        <button
          onClick={() => handleSave()}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-sm transition-all duration-200 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
          ) : saveSuccess ? (
            <Check size={16} className="text-emerald-400" />
          ) : (
            <Save size={16} />
          )}
          <span>{isSaving ? 'Menyimpan...' : saveSuccess ? 'Tersimpan!' : 'Simpan Perubahan'}</span>
        </button>
      </div>

      {/* Notifications / Alerts */}
      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300 text-sm animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Pengaturan keluarga berhasil diperbarui dan disinkronkan ke seluruh sistem!</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-sm">
          <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Modern Minimalist Segmented Tabs */}
      <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-900/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 w-fit">
        <button
          onClick={() => setActiveTab('family')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeTab === 'family'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Users size={15} />
          <span>Profil Pasangan & Keluarga</span>
        </button>
        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeTab === 'telegram'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Send size={15} />
          <span>Integrasi Bot Telegram</span>
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeTab === 'preferences'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Sliders size={15} />
          <span>Preferensi Finansial</span>
        </button>
      </div>

      {/* ================= TAB 1: KELUARGA & PASANGAN ================= */}
      {activeTab === 'family' && (
        <div className="space-y-6">
          {/* Card Ruang Finansial */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Nama Ruang Keuangan / Keluarga
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Nama identitas akun keluarga ini yang akan disapa oleh asisten AI.
                </p>
              </div>
              <Sparkles size={18} className="text-amber-500" />
            </div>

            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Contoh: Keluarga Sakinah, Finansial Kami, dll."
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all"
            />
          </div>

          {/* Banner Kapasitas Pasangan */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60">
            <ShieldCheck size={20} className="text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0" />
            <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <span className="font-semibold text-zinc-900 dark:text-zinc-200">Kapasitas Khusus Sepasang (Maksimal 2 Person):</span>{' '}
              Monify didesain dengan filosofi transparansi keuangan berdua. Setiap pasangan memiliki slot identitas dan peran yang dapat disesuaikan secara bebas (Ayah/Ibu, Suami/Istri, atau Partner).
            </div>
          </div>

          {/* Dua Kartu Pasangan Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Slot Anggota 1 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-base">
                    🧑
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pasangan 1 (Utama)</h3>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">Slot Profil #1</span>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                  {m1Role || 'Suami'}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nama Panggilan
                  </label>
                  <input
                    type="text"
                    value={m1Name}
                    onChange={(e) => setM1Name(e.target.value)}
                    placeholder="Contoh: Ayah, Budi, Qisthi"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Peran dalam Keluarga
                  </label>
                  <select
                    value={['Suami', 'Ayah', 'Kepala Keluarga'].includes(m1Role) ? m1Role : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setM1Role(e.target.value);
                      } else {
                        setM1Role('');
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="Suami">Suami</option>
                    <option value="Ayah">Ayah</option>
                    <option value="Kepala Keluarga">Kepala Keluarga</option>
                    <option value="custom">✍️ Lainnya (Ketik Sendiri)...</option>
                  </select>

                  {!['Suami', 'Ayah', 'Kepala Keluarga'].includes(m1Role) && (
                    <input
                      type="text"
                      value={m1Role}
                      onChange={(e) => setM1Role(e.target.value)}
                      placeholder="Ketik peran, misal: Abi / Papi"
                      className="w-full mt-2 px-3.5 py-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      autoFocus
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Telegram User ID (Opsional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={m1Telegram}
                      onChange={(e) => setM1Telegram(e.target.value)}
                      placeholder="Contoh: 616300758"
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleTestTelegram(1)}
                      disabled={isTestingTg || !m1Telegram || !tgBotToken}
                      className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                      title="Tes kirim pesan ke Telegram ini"
                    >
                      Tes Ping
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                    Diperlukan jika ingin menerima notifikasi atau chat lewat bot Telegram.
                  </span>
                </div>
              </div>
            </div>

            {/* Slot Anggota 2 */}
            <div className={`p-6 rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-300 space-y-5 ${
              partnerEnabled 
                ? 'border-zinc-200/80 dark:border-zinc-800/80' 
                : 'border-zinc-200/40 dark:border-zinc-800/40 bg-zinc-50/50 dark:bg-zinc-900/40'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base transition-colors ${
                    partnerEnabled 
                      ? 'bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                  }`}>
                    👩
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pasangan 2 (Partner)</h3>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">Slot Profil #2</span>
                  </div>
                </div>

                {/* Toggle Aktif / Nonaktif */}
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-semibold ${partnerEnabled ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-400'}`}>
                    {partnerEnabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={partnerEnabled}
                      onChange={(e) => setPartnerEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all dark:border-zinc-600 peer-checked:bg-violet-600"></div>
                  </label>
                </div>
              </div>

              {!partnerEnabled ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center text-zinc-400">
                    <Users size={22} className="opacity-40" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Mode Single (1 Pengguna)</h4>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-xs mx-auto mt-1">
                      Partner dinonaktifkan. Seluruh menu (dashboard, jatah, dan asisten AI) hanya akan menampilkan profil tunggal Anda.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPartnerEnabled(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:hover:bg-violet-900/50 dark:text-violet-300 text-xs font-semibold transition-colors"
                  >
                    <span>+ Aktifkan Akun Pasangan</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nama Panggilan
                    </label>
                    <input
                      type="text"
                      value={m2Name}
                      onChange={(e) => setM2Name(e.target.value)}
                      placeholder="Contoh: Ibu, Ani, Gita"
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Peran dalam Keluarga
                  </label>
                  <select
                    value={['Istri', 'Ibu', 'Pengelola Keuangan'].includes(m2Role) ? m2Role : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setM2Role(e.target.value);
                      } else {
                        setM2Role('');
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="Istri">Istri</option>
                    <option value="Ibu">Ibu</option>
                    <option value="Pengelola Keuangan">Pengelola Keuangan</option>
                    <option value="custom">✍️ Lainnya (Ketik Sendiri)...</option>
                  </select>

                  {!['Istri', 'Ibu', 'Pengelola Keuangan'].includes(m2Role) && (
                    <input
                      type="text"
                      value={m2Role}
                      onChange={(e) => setM2Role(e.target.value)}
                      placeholder="Ketik peran, misal: Umi / Mami"
                      className="w-full mt-2 px-3.5 py-2 rounded-xl border border-dashed border-violet-400 bg-violet-50/30 dark:bg-violet-950/20 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      autoFocus
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Telegram User ID (Opsional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={m2Telegram}
                      onChange={(e) => setM2Telegram(e.target.value)}
                      placeholder="Contoh: 8651953651"
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleTestTelegram(2)}
                      disabled={isTestingTg || !m2Telegram || !tgBotToken}
                      className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                      title="Tes kirim pesan ke Telegram ini"
                    >
                      Tes Ping
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                    Diperlukan jika ingin menerima notifikasi atau chat lewat bot Telegram.
                  </span>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: INTEGRASI TELEGRAM ================= */}
      {activeTab === 'telegram' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Integrasi Bot Telegram
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Hubungkan Monify dengan Bot Telegram agar bisa mencatat transaksi atau menerima notifikasi di luar aplikasi.
                </p>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tgEnabled}
                  onChange={(e) => setTgEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {testTgStatus && (
              <div
                className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
                  testTgStatus.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                {testTgStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{testTgStatus.message}</span>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Telegram Bot Token
                </label>
                <div className="relative">
                  <input
                    type={showBotToken ? 'text' : 'password'}
                    value={tgBotToken}
                    onChange={(e) => setTgBotToken(e.target.value)}
                    placeholder="Contoh: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm font-mono text-zinc-900 dark:text-zinc-100 pr-10 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBotToken(!showBotToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showBotToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                  Didapatkan dari bot resmi <b>@BotFather</b> di Telegram saat membuat bot.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Username Bot
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
                  <input
                    type="text"
                    value={tgBotUsername}
                    onChange={(e) => setTgBotUsername(e.target.value.replace('@', ''))}
                    placeholder="MoniAssistantBot"
                    className="w-full pl-8 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
              </div>
            </div>

            {/* Panduan Singkat */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
              <span className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                <Bot size={14} /> Panduan Menghubungkan Bot:
              </span>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Buka aplikasi Telegram, cari <b>@BotFather</b> dan kirim <code>/newbot</code>.</li>
                <li>Ikuti instruksi hingga mendapatkan <b>HTTP API Token</b>, lalu salin ke kolom di atas.</li>
                <li>Untuk mengetahui ID Telegram masing-masing pasangan, cari bot <b>@userinfobot</b> di Telegram dan ketik apa saja untuk melihat ID angka Anda.</li>
                <li>Masukkan ID tersebut ke kolom <i>Telegram User ID</i> di tab <b>Profil Pasangan</b>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: PREFERENSI FINANSIAL ================= */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 space-y-5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Preferensi Keuangan & Notifikasi
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Mata Uang Standar
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value="IDR">Rupiah Indonesia (Rp / IDR)</option>
                  <option value="USD">US Dollar ($ / USD)</option>
                  <option value="SGD">Singapore Dollar (S$ / SGD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Peringatan Saldo Minim (Low Fund Alert)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">Rp</span>
                  <input
                    type="number"
                    value={lowFundThreshold}
                    onChange={(e) => setLowFundThreshold(Number(e.target.value))}
                    step="50000"
                    min="0"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                  Sistem akan mengirim notifikasi peringatan jika saldo kantong atau aset berada di bawah nominal ini.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SettingsPage;
