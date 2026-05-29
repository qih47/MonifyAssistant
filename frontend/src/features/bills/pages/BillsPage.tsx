import React, { useState } from 'react';
import { useBills, type Bill, type Installment } from '../hooks/useBills';
import { usePockets } from '../../pockets/hooks/usePockets';
import { formatIDR } from '../../../lib/formatter';
import { formatDateIndo } from '../../../lib/dateFormatter';
import { supabase } from '../../../config/supabase';
import { Plus, Loader2, X, Trash2, Percent } from 'lucide-react';
import Swal from 'sweetalert2';

export const BillsPage = () => {
  const { bills, installments, loading, addBill, payBill, deleteBill, addInstallment, payInstallmentMonth, deleteInstallment } = useBills();
  const { pockets } = usePockets();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'bill' | 'installment'>('bill');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [pocketId, setPocketId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [tenorMonths, setTenorMonths] = useState('');
  const [ownership, setOwnership] = useState('bersama');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper: deteksi dark mode
  const isDarkMode = () => document.documentElement.classList.contains('dark');

  const getSwalStyle = () => ({
    popup: isDarkMode()
      ? 'bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-2xl'
      : 'bg-white text-slate-900 rounded-2xl border shadow-2xl',
    inputBg: isDarkMode() ? '#1e293b' : '#ffffff',
    inputText: isDarkMode() ? '#f1f5f9' : '#1e293b',
    inputBorder: isDarkMode() ? '#475569' : '#d1d5db',
    labelColor: isDarkMode() ? '#cbd5e1' : '#374151',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (modalType === 'bill') {
      if (!name || !amount || !dueDate || !pocketId) { setIsSubmitting(false); return; }
      const result = await addBill(name, parseFloat(amount), parseInt(dueDate), parseInt(pocketId));
      if (result.success) resetForm();
    } else {
      if (!name || !totalAmount || !tenorMonths || !pocketId) { setIsSubmitting(false); return; }
      const total = parseFloat(totalAmount);
      const dp = parseFloat(downPayment || '0');
      const tenor = parseInt(tenorMonths);
      const monthlyCalculated = Math.round((total - dp) / tenor);
      const result = await addInstallment(name, total, dp, tenor, monthlyCalculated, parseInt(pocketId), ownership);
      if (result.success) resetForm();
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setName(''); setAmount(''); setDueDate(''); setPocketId('');
    setTotalAmount(''); setDownPayment(''); setTenorMonths('');
    setOwnership('bersama');
  };

  const handlePayBill = async (bill: Bill) => {
    const s = getSwalStyle();

    const { value: formValues } = await Swal.fire({
      title: 'Konfirmasi Pembayaran Tagihan',
      html: `
        <div style="text-align:left;margin-bottom:1rem;color:inherit;">
          <p style="font-weight:bold;font-size:14px;">${bill.name}</p>
          <p style="font-size:18px;font-weight:900;margin-top:4px;">${formatIDR(bill.amount)}</p>
        </div>
        <label style="display:block;text-align:left;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;color:${s.labelColor};">Pilih Kantong Dana:</label>
        <select id="swal-pocket-select" style="font-size:13px;padding:8px;width:100%;background:${s.inputBg};color:${s.inputText};border:1px solid ${s.inputBorder};border-radius:8px;outline:none;">
          ${pockets.map(p => `<option value="${p.id}">${p.display_name} — ${formatIDR(p.current_balance)}</option>`).join('')}
        </select>
        <label style="display:block;text-align:left;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin-top:12px;margin-bottom:6px;color:${s.labelColor};">Eksekutor:</label>
        <select id="swal-actor-select" style="font-size:13px;padding:8px;width:100%;background:${s.inputBg};color:${s.inputText};border:1px solid ${s.inputBorder};border-radius:8px;outline:none;">
          <option value="suami">🧑 Qisthi (Suami)</option>
          <option value="istri">👩 Gita (Istri)</option>
        </select>
      `,
      showCancelButton: true,
      confirmButtonText: 'Bayar Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      customClass: { popup: s.popup },
      preConfirm: () => {
        const pid = (document.getElementById('swal-pocket-select') as HTMLSelectElement)?.value;
        const act = (document.getElementById('swal-actor-select') as HTMLSelectElement)?.value;
        if (!pid || pid === '') { Swal.showValidationMessage('Pilih kantong dana dulu!'); return false; }
        return { pocketId: Number(pid), actor: act };
      }
    });

    if (formValues) {
      const updatedBill = { ...bill, pocket_id: formValues.pocketId };
      const r = await payBill(updatedBill, formValues.actor as 'suami' | 'istri');
      if (!r.success) Swal.fire('Gagal!', r.error || 'Terjadi kesalahan!', 'error');
      else Swal.fire('Sukses!', `Tagihan ${bill.name} berhasil dibayar.`, 'success');
    }
  };

  const handlePayInstallment = async (inst: Installment) => {
    const s = getSwalStyle();
    const totalSudahBayar = inst.down_payment + (inst.total_log_paid || 0);
    const maxSisa = inst.total_amount - totalSudahBayar;

    const { value: formValues } = await Swal.fire({
      title: 'Bayar Cicilan',
      html: `
        <div style="text-align:left;font-size:12px;margin-bottom:1rem;color:inherit;">
          <p style="font-weight:bold;font-size:14px;">${inst.name}</p>
          <p style="margin-top:4px;">Beban Tetap: <span style="font-family:monospace;font-weight:bold;">${formatIDR(inst.monthly_amount)}</span></p>
          <p style="color:#9ca3af;margin-top:4px;">Sisa utang: ${formatIDR(maxSisa)}</p>
        </div>
        <label style="display:block;text-align:left;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;color:${s.labelColor};">Nominal Bayar (Rp):</label>
        <input id="swal-custom-amount" type="number" style="font-size:14px;font-weight:bold;width:100%;padding:8px;background:${s.inputBg};color:${s.inputText};border:1px solid ${s.inputBorder};border-radius:8px;outline:none;" value="${inst.monthly_amount}" placeholder="Masukkan nominal"/>
        <label style="display:block;text-align:left;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin-top:12px;margin-bottom:6px;color:${s.labelColor};">Pilih Kantong Dana:</label>
        <select id="swal-pocket-select" style="font-size:13px;padding:8px;width:100%;background:${s.inputBg};color:${s.inputText};border:1px solid ${s.inputBorder};border-radius:8px;outline:none;">
          ${pockets.map(p => `<option value="${p.id}" ${String(p.id) === String(inst.pocket_id) ? 'selected' : ''}>${p.display_name} — ${formatIDR(p.current_balance)}</option>`).join('')}
        </select>
        <label style="display:block;text-align:left;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin-top:12px;margin-bottom:6px;color:${s.labelColor};">Eksekutor:</label>
        <select id="swal-actor-select" style="font-size:13px;padding:8px;width:100%;background:${s.inputBg};color:${s.inputText};border:1px solid ${s.inputBorder};border-radius:8px;outline:none;">
          <option value="suami">🧑 Qisthi (Suami)</option>
          <option value="istri">👩 Gita (Istri)</option>
        </select>
      `,
      showCancelButton: true,
      confirmButtonText: 'Bayar',
      confirmButtonColor: '#10b981',
      customClass: { popup: s.popup },
      preConfirm: () => {
        const amt = parseFloat((document.getElementById('swal-custom-amount') as HTMLInputElement)?.value || '');
        const pid = (document.getElementById('swal-pocket-select') as HTMLSelectElement)?.value;
        const act = (document.getElementById('swal-actor-select') as HTMLSelectElement)?.value;
        if (!amt || amt <= 0) { Swal.showValidationMessage('Nominal harus valid!'); return false; }
        if (amt > maxSisa) { Swal.showValidationMessage(`Maksimal ${formatIDR(maxSisa)}`); return false; }
        if (!pid || pid === '') { Swal.showValidationMessage('Pilih kantong dana dulu!'); return false; }
        return { amount: amt, pocketId: Number(pid), actor: act };
      }
    });

    if (formValues) {
      const updatedInst = { ...inst, pocket_id: formValues.pocketId };
      const r = await payInstallmentMonth(updatedInst, formValues.amount, formValues.actor as any);
      if (r.success) Swal.fire('Sukses!', 'Cicilan berhasil dibayar.', 'success');
      else Swal.fire('Gagal!', r.error || 'Error!', 'error');
    }
  };

  const handleViewHistory = async (inst: Installment) => {
    try {
      const { data, error } = await supabase
        .from('installment_logs')
        .select('*')
        .eq('installment_id', inst.id)
        .order('billing_month', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        Swal.fire({ title: 'Riwayat Kosong', text: 'Belum ada catatan setoran.', icon: 'info', customClass: { popup: 'bg-white dark:bg-slate-900 rounded-2xl' } });
        return;
      }

      const s = getSwalStyle();
      const tableRows = data.map((log: any) => `
        <tr style="border-bottom:1px solid ${s.inputBorder};font-size:12px;color:inherit;">
          <td style="padding:10px;font-weight:bold;text-align:center;">Bulan ke-${log.billing_month}</td>
          <td style="padding:10px;font-weight:900;color:#10b981;text-align:right;">${formatIDR(Number(log.amount_paid))}</td>
          <td style="padding:10px;text-align:center;">${formatDateIndo(log.paid_at)}</td>
        </tr>
      `).join('');

      Swal.fire({
        title: `Audit Log: ${inst.name}`,
        html: `<div style="overflow-x:auto;max-height:300px;"><table style="width:100%;color:inherit;border-collapse:collapse;"><thead><tr style="background:${s.inputBg};font-size:10px;text-transform:uppercase;font-weight:900;letter-spacing:0.05em;color:${s.labelColor};"><th style="padding:8px;text-align:center;">Tenor</th><th style="padding:8px;text-align:right;">Nominal</th><th style="padding:8px;text-align:center;">Tanggal</th></tr></thead><tbody>${tableRows}</tbody></table></div>`,
        confirmButtonText: 'Tutup',
        confirmButtonColor: '#2563eb',
        customClass: { popup: s.popup }
      });
    } catch (err) {
      console.error('Error loading logs:', err);
    }
  };

  const getOwnershipLabel = (owner: string) => {
    switch (owner) {
      case 'suami': return <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md dark:bg-blue-950/40 dark:text-blue-400">Kontrak Qisthi</span>;
      case 'istri': return <span className="text-[10px] font-bold px-2 py-0.5 bg-pink-50 border border-pink-100 text-pink-600 rounded-md dark:bg-pink-950/40 dark:text-pink-400">Kontrak Gita</span>;
      default: return <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-md dark:bg-slate-800 dark:text-slate-400">Kontrak Bersama</span>;
    }
  };

  return (
    <div className="space-y-10">
      {/* TAGIHAN BULANAN */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Tagihan & Pengingat Rutin</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pengeluaran flat bulanan tetap aman terpantau.</p>
          </div>
          <button onClick={() => { setModalType('bill'); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium text-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900">
            <Plus size={14} /><span>Tambah Tagihan</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : bills.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Belum ada daftar pengingat rutin.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bills.map((bill) => {
              const isPaid = bill.status === 'paid';
              return (
                <div key={bill.id} className={`p-4 bg-white border rounded-2xl flex flex-col justify-between dark:bg-slate-900 ${isPaid ? 'border-emerald-100' : 'border-slate-100 dark:border-slate-800'}`}>
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="font-bold text-sm truncate">{bill.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{isPaid ? 'Lunas' : 'Belum Bayar'}</span>
                    </div>
                    <p className="text-lg font-black mb-2">{formatIDR(bill.amount)}</p>
                    <p className="text-[11px] text-slate-400">Tempo: Tiap Tanggal {bill.due_date}</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {!isPaid ? (
                      <button onClick={() => handlePayBill(bill)} className="flex-1 py-1.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-lg text-xs font-bold">Bayar</button>
                    ) : (
                      <div className="flex-1 py-1.5 bg-emerald-50 text-emerald-600 text-center text-xs font-bold rounded-lg">Terbayar</div>
                    )}
                    <button onClick={() => deleteBill(bill.id)} className="p-1.5 text-slate-400 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CICILAN */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Pelacak Cicilan & Kontrak Kredit</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pantau progres sisa pokok utang dan riwayat pembayaran.</p>
          </div>
          <button onClick={() => { setModalType('installment'); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium text-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900">
            <Plus size={14} /><span>Tambah Target Cicilan</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : installments.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-900/20 dark:border-slate-800">
            <Percent size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Belum ada data pelacakan cicilan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {installments.map((inst) => {
              const totalSudahBayar = inst.down_payment + (inst.total_log_paid || 0);
              const sisaUtang = inst.total_amount - totalSudahBayar;
              const persentaseProgres = Math.min(100, parseFloat(((totalSudahBayar / inst.total_amount) * 100).toFixed(2)));
              const isLunasTotal = inst.paid_months >= inst.tenor_months;

              return (
                <div key={inst.id} className="p-5 bg-white border border-slate-100 dark:border-slate-800 dark:bg-slate-900 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col gap-1">
                        <span onClick={() => handleViewHistory(inst)} className="font-bold text-base hover:text-blue-500 cursor-pointer underline decoration-dashed">{inst.name}</span>
                        <div>{getOwnershipLabel(inst.ownership)}</div>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${isLunasTotal ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600'}`}>{inst.paid_months}/{inst.tenor_months} Bln</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
                      <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${persentaseProgres}%` }}></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                      <div><p className="text-slate-400">Harga Total</p><p className="font-bold">{formatIDR(inst.total_amount)}</p></div>
                      <div><p className="text-slate-400">DP Awal</p><p className="font-bold">{formatIDR(inst.down_payment)}</p></div>
                      <div><p className="text-slate-400">Sudah Terbayar</p><p className="font-bold text-emerald-600">{formatIDR(totalSudahBayar)} ({persentaseProgres}%)</p></div>
                      <div><p className="text-slate-400">Sisa Pokok</p><p className="font-bold text-rose-500">{formatIDR(sisaUtang <= 0 ? 0 : sisaUtang)}</p></div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl flex justify-between items-center text-xs">
                      <div><p className="text-slate-400">Beban Bulanan</p><p className="font-black text-sm">{formatIDR(inst.monthly_amount)}</p></div>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 font-bold px-2 py-1 rounded-md">{inst.pocket_name}</span>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    {!isLunasTotal ? (
                      <button onClick={() => handlePayInstallment(inst)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">Bayar Cicilan</button>
                    ) : (
                      <div className="flex-1 py-2 bg-emerald-100 text-emerald-700 text-center text-xs font-black rounded-xl">LUNAS 🎉</div>
                    )}
                    <button onClick={() => { if (window.confirm('Hapus?')) deleteInstallment(inst.id); }} className="p-2 border hover:text-rose-500 rounded-xl"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border shadow-2xl p-6 relative">
            <button onClick={resetForm} className="absolute top-4 right-4 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded-lg"><X size={18} /></button>
            <h4 className="text-base font-bold mb-4">{modalType === 'bill' ? 'Buat Pengingat Tagihan Baru' : 'Daftarkan Target Kontrak Cicilan'}</h4>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase mb-1">Nama</label>
                <input type="text" required placeholder={modalType === 'bill' ? "WiFi Biznet" : "iPhone 17 Pro"} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
              </div>
              {modalType === 'bill' ? (
                <>
                  <div><label className="block font-bold uppercase mb-1">Nominal (Rp)</label><input type="number" required placeholder="350000" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
                  <div><label className="block font-bold uppercase mb-1">Jatuh Tempo (1-31)</label><input type="number" min="1" max="31" required placeholder="5" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
                </>
              ) : (
                <>
                  <div><label className="block font-bold uppercase mb-1">Harga Total (Rp)</label><input type="number" required placeholder="17000000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
                  <div><label className="block font-bold uppercase mb-1">DP Awal (Rp)</label><input type="number" placeholder="6000000" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
                  <div><label className="block font-bold uppercase mb-1">Tenor (Bulan)</label><input type="number" required placeholder="12" value={tenorMonths} onChange={(e) => setTenorMonths(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
                  <div>
                    <label className="block font-bold uppercase mb-1">Penanggung Jawab</label>
                    <select value={ownership} onChange={(e) => setOwnership(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold">
                      <option value="bersama">👪 Bersama</option>
                      <option value="suami">🧑 Qisthi</option>
                      <option value="istri">👩 Gita</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block font-bold uppercase mb-1">Kantong Dana</label>
                <select required value={pocketId} onChange={(e) => setPocketId(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                  <option value="">-- Pilih --</option>
                  {pockets.map((p) => (<option key={p.id} value={p.id}>{p.display_name} ({formatIDR(p.current_balance)})</option>))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-xl font-semibold text-slate-600 dark:text-slate-400">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-1 px-4 py-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl font-bold">
                  {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};