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

  // State Modal Global & Tipe
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'bill' | 'installment'>('bill');

  // State Common Inputs
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [pocketId, setPocketId] = useState('');

  // State Khusus Bill
  const [dueDate, setDueDate] = useState('');

  // State Khusus Cicilan (Installments)
  const [totalAmount, setTotalAmount] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [tenorMonths, setTenorMonths] = useState('');
  const [ownership, setOwnership] = useState('bersama'); // State baru kepemilikan cicilan
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (modalType === 'bill') {
      if (!name || !amount || !dueDate || !pocketId) {
        setIsSubmitting(false);
        return;
      }
      const result = await addBill(name, parseFloat(amount), parseInt(dueDate), parseInt(pocketId));
      if (result.success) resetForm();
    } else {
      if (!name || !totalAmount || !tenorMonths || !pocketId) {
        setIsSubmitting(false);
        return;
      }
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
    setName('');
    setAmount('');
    setDueDate('');
    setPocketId('');
    setTotalAmount('');
    setDownPayment('');
    setTenorMonths('');
    setOwnership('bersama');
  };

  const handlePayBill = async (bill: Bill) => {
    // Konfirmasi aktor pembayar via SweetAlert yang nyaman
    const { value: activeActor } = await Swal.fire({
      title: 'Siapa yang Bayar, Cuy?',
      input: 'select',
      inputOptions: {
        suami: '🧑 Qisthi (Suami)',
        istri: '👩 Gita (Istri)'
      },
      inputPlaceholder: '-- Pilih Aktor Pembayar --',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      inputValue: 'suami', // <-- SEKARANG PAKAI INPUTVALUE, SEKETIKA AMAN LURUS!
      customClass: { popup: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl' }
    });

    if (activeActor) {
      const r = await payBill(bill, activeActor);
      if (!r.success) {
        Swal.fire('Gagal!', r.error || 'Terjadi kesalahan!', 'error');
      } else {
        Swal.fire('Sukses!', `Tagihan ${bill.name} berhasil dibayar oleh ${activeActor === 'suami' ? 'Qisthi' : 'Gita'}.`, 'success');
      }
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
        Swal.fire({
          title: 'Riwayat Kosong',
          text: 'Belum ada catatan setoran cicilan bulanan untuk barang ini.',
          icon: 'info',
          customClass: { popup: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl' }
        });
        return;
      }

      const tableRows = data.map((log: any) => `
        <tr class="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/20 text-xs text-slate-800 dark:text-slate-200">
          <td class="py-2.5 font-bold font-mono text-center">Bulan ke-${log.billing_month}</td>
          <td class="py-2.5 font-black text-emerald-600 dark:text-emerald-400 text-right">${formatIDR(Number(log.amount_paid))}</td>
          <td class="py-2.5 text-slate-500 dark:text-slate-400 text-center font-mono">${formatDateIndo(log.paid_at)}</td>
        </tr>
      `).join('');

      Swal.fire({
        title: `Audit Log: ${inst.name}`,
        html: `<div class="overflow-x-auto max-h-60 mt-2 border border-slate-100 dark:border-slate-800 rounded-xl"><table class="w-full text-left border-collapse"><thead><tr class="bg-slate-50 dark:bg-slate-950 text-[10px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800"><th class="py-2 text-center">Tenor</th><th class="py-2 text-right">Nominal Bayar</th><th class="py-2 text-center">Tanggal Setor</th></tr></thead><tbody>${tableRows}</tbody></table></div>`,
        confirmButtonText: 'Tutup Panel',
        confirmButtonColor: '#2563eb',
        customClass: {
          popup: 'bg-white dark:bg-slate-900 rounded-2xl border text-slate-900 dark:text-white shadow-2xl p-4 w-full max-w-md',
          title: 'text-base font-black text-slate-900 dark:text-white',
          htmlContainer: 'text-slate-800 dark:text-slate-200',
        }
      });
    } catch (err) {
      console.error('Error loading logs:', err);
    }
  };

  const handlePayInstallment = async (inst: Installment) => {
    const totalSudahBayar = inst.down_payment + (inst.total_log_paid || 0);
    const maxSisa = inst.total_amount - totalSudahBayar;

    const { value: formValues } = await Swal.fire({
      title: 'Bayar Cicilan',
      html: `
        <div class="text-left text-xs mb-4 text-slate-700 dark:text-slate-300">
          <p class="font-bold text-sm text-slate-900 dark:text-white">${inst.name}</p>
          <p class="mt-1">Beban Tetap Sistem: <span class="font-mono font-bold text-slate-950 dark:text-emerald-400">${formatIDR(inst.monthly_amount)}</span></p>
        </div>
        
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 text-left">Pilih Nominal Instan:</label>
        <div class="grid grid-cols-2 gap-2 mb-4">
          <button type="button" class="p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" onclick="document.getElementById('swal-custom-amount').value='500000'">500.000</button>
          <button type="button" class="p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" onclick="document.getElementById('swal-custom-amount').value='1000000'">1.000.000</button>
          <button type="button" class="p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" onclick="document.getElementById('swal-custom-amount').value='1500000'">1.500.000</button>
          <button type="button" class="p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" onclick="document.getElementById('swal-custom-amount').value='2000000'">2.000.000</button>
          <button type="button" class="p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" onclick="document.getElementById('swal-custom-amount').value='2500000'">2.500.000</button>
          <button type="button" class="p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-sm" onclick="document.getElementById('swal-custom-amount').value='${inst.monthly_amount}'">Sesuai Beban</button>
        </div>

        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 text-left">Atau Isi Manual (Rp):</label>
        <input id="swal-custom-amount" type="number" class="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold mb-3" value="${inst.monthly_amount}"/>

        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 text-left">Siapa eksekutornya, Cuy?:</label>
        <select id="swal-actor-select" class="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white focus:outline-none font-bold">
          <option value="suami">🧑 Qisthi (Suami)</option>
          <option value="istri">👩 Gita (Istri)</option>
        </select>
      `,
      showCancelButton: true,
      confirmButtonText: 'Eksekusi Bayar',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      focusConfirm: false,
      customClass: {
        popup: 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl',
        title: 'text-lg font-black text-slate-900 dark:text-white',
        htmlContainer: 'text-slate-800 dark:text-slate-200',
      },
      preConfirm: () => {
        const amountValue = (document.getElementById('swal-custom-amount') as HTMLInputElement).value;
        const actorValue = (document.getElementById('swal-actor-select') as HTMLSelectElement).value;
        const parsedAmount = parseFloat(amountValue);

        if (!parsedAmount || parsedAmount <= 0) {
          Swal.showValidationMessage('Nominal input kudu valid, Cuy!');
          return false;
        }
        if (parsedAmount > maxSisa) {
          Swal.showValidationMessage(`Nominal kegedean! Sisa utang tinggal ${formatIDR(maxSisa)}`);
          return false;
        }
        return { amount: parsedAmount, actor: actorValue };
      }
    });

    if (formValues) {
      Swal.fire({
        title: 'Konfirmasi Pembayaran',
        text: `Beneran mau potong kantong sebesar ${formatIDR(formValues.amount)}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Potong Saldo!',
        cancelButtonText: 'Cek Lagi',
        confirmButtonColor: '#10b981',
        customClass: { popup: 'bg-white dark:bg-slate-900 rounded-2xl border' }
      }).then(async (result) => {
        if (result.isConfirmed) {
          const r = await payInstallmentMonth(inst, formValues.amount, formValues.actor as any);

          if (r.success) {
            Swal.fire({ title: 'Sukses!', text: 'Cicilan berhasil dibayar dan tercatat di jurnal mutasi.', icon: 'success', timer: 2000, showConfirmButton: false });
          } else {
            Swal.fire({ title: 'Gagal!', text: r.error || 'Terjadi gangguan database.', icon: 'error' });
          }
        }
      });
    }
  };

  const getOwnershipLabel = (owner: string) => {
    switch (owner) {
      case 'suami': return <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900">Kontrak Qisthi</span>;
      case 'istri': return <span className="text-[10px] font-bold px-2 py-0.5 bg-pink-50 border border-pink-100 text-pink-600 rounded-md dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-900">Kontrak Gita</span>;
      default: return <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-md dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">Kontrak Bersama</span>;
    }
  };

  return (
    <div className="space-y-10">
      {/* ==================== SEKTOR 1: TAGIHAN BULANAN ==================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Tagihan & Pengingat Rutin</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pengeluaran flat bulanan tetap aman terpantau.</p>
          </div>
          <button onClick={() => { setModalType('bill'); setIsModalOpen(true); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium text-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
            <Plus size={14} />
            <span>Tambah Tagihan</span>
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
                <div key={bill.id} className={`p-4 bg-white border rounded-2xl flex flex-col justify-between dark:bg-slate-900 ${isPaid ? 'border-emerald-100 bg-emerald-50/5' : 'border-slate-100 dark:border-slate-800'}`}>
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{bill.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{isPaid ? 'Lunas' : 'Belum Bayar'}</span>
                    </div>
                    <p className="text-lg font-black text-slate-900 dark:text-white mb-2">{formatIDR(bill.amount)}</p>
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

      {/* ==================== SEKTOR 2: TRACKING TARGET CICILAN ==================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Pelacak Cicilan & Kontrak Kredit</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pantau progres sisa pokok utang dan riwayat pembayaran barang besar.</p>
          </div>
          <button onClick={() => { setModalType('installment'); setIsModalOpen(true); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium text-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
            <Plus size={14} />
            <span>Tambah Target Cicilan</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : installments.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-900/20 dark:border-slate-800">
            <Percent size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Belum ada data pelacakan cicilan besar berjalan.</p>
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
                        <span onClick={() => handleViewHistory(inst)} className="font-bold text-base text-slate-800 dark:text-slate-100 hover:text-blue-500 cursor-pointer underline decoration-dashed decoration-slate-300 dark:decoration-slate-700 transition-colors" title="Klik untuk melihat riwayat bayar">
                          {inst.name}
                        </span>
                        <div>{getOwnershipLabel(inst.ownership)}</div>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${isLunasTotal ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600'}`}>
                        {inst.paid_months}/{inst.tenor_months} Bln
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
                      <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${persentaseProgres}%` }}></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                      <div><p className="text-slate-400 font-medium">Harga Total</p><p className="font-bold text-slate-700 dark:text-slate-200">{formatIDR(inst.total_amount)}</p></div>
                      <div><p className="text-slate-400 font-medium">DP Awal</p><p className="font-bold text-slate-600 dark:text-slate-300">{formatIDR(inst.down_payment)}</p></div>
                      <div><p className="text-slate-400 font-medium">Sudah Terbayar</p><p className="font-bold text-emerald-600">{formatIDR(totalSudahBayar)} ({persentaseProgres}%)</p></div>
                      <div><p className="text-slate-400 font-medium">Sisa Pokok Utang</p><p className="font-bold text-rose-500">{formatIDR(sisaUtang <= 0 ? 0 : sisaUtang)}</p></div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl flex justify-between items-center text-xs">
                      <div><p className="text-slate-400 font-medium">Beban Bulanan</p><p className="font-black text-slate-800 dark:text-white text-sm">{formatIDR(inst.monthly_amount)}</p></div>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-1 rounded-md">Mata Uang Dana: {inst.pocket_name}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    {!isLunasTotal ? (
                      <button onClick={() => handlePayInstallment(inst)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm">Bayar Cicilan Bulan Ini</button>
                    ) : (
                      <div className="flex-1 py-2 bg-emerald-100 text-emerald-700 text-center text-xs font-black rounded-xl">LUNAS TOTAL 🎉</div>
                    )}
                    <button onClick={() => { if (window.confirm('Hapus pelacak cicilan ini?')) deleteInstallment(inst.id); }} className="p-2 border border-slate-100 dark:border-slate-800 hover:text-rose-500 rounded-xl"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== INPUT DIALOG MODAL DYNAMIC ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 relative">
            <button onClick={resetForm} className="absolute top-4 right-4 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded-lg"><X size={18} /></button>
            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-4">{modalType === 'bill' ? 'Buat Pengingat Tagihan Baru' : 'Daftarkan Target Kontrak Cicilan'}</h4>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Nama Barang / Tagihan</label>
                <input type="text" required placeholder={modalType === 'bill' ? "Contoh: WiFi Biznet" : "Contoh: iPhone 17 Pro"} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100" />
              </div>

              {modalType === 'bill' ? (
                <>
                  <div><label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Nominal Bulanan (Rp)</label><input type="number" required placeholder="Contoh: 350000" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-800" /></div>
                  <div><label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Tanggal Jatuh Tempo (1-31)</label><input type="number" min="1" max="31" required placeholder="Contoh: 5" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-800" /></div>
                </>
              ) : (
                <>
                  <div><label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Harga Total Barang (Rp)</label><input type="number" required placeholder="Contoh: 17000000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-slate-800" /></div>
                  <div><label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Uang Muka / DP Awal (Rp)</label><input type="number" placeholder="Contoh: 6000000" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-slate-800" /></div>
                  <div><label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Tenor Kredit (Bulan)</label><input type="number" required placeholder="Contoh: 12" value={tenorMonths} onChange={(e) => setTenorMonths(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-slate-800" /></div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Penanggung Jawab Kontrak</label>
                    <select value={ownership} onChange={(e) => setOwnership(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold">
                      <option value="bersama">👪 Cicilan Bersama Keluarga</option>
                      <option value="suami">🧑 Tanggungan Pribadi Qisthi</option>
                      <option value="istri">👩 Tanggungan Pribadi Gita</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Alokasi Kantong Sumber Dana</label>
                <select required value={pocketId} onChange={(e) => setPocketId(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100">
                  <option value="">-- Pilih Kantong --</option>
                  {pockets.map((p) => (<option key={p.id} value={p.id}>{p.display_name} (Sisa: {formatIDR(p.current_balance)})</option>))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-xl font-semibold text-slate-500">Batal</button>
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