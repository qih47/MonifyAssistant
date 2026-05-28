import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

export interface Bill {
  id: number;
  name: string;
  amount: number;
  due_date: number;
  is_recurring: boolean;
  status: string;
  last_paid_at: string | null;
  pocket_id: number | null;
  pocket_name?: string;
}

export interface Installment {
  id: number;
  name: string;
  total_amount: number;
  down_payment: number;
  tenor_months: number;
  paid_months: number;
  monthly_amount: number;
  pocket_id: number | null;
  pocket_name?: string;
  ownership: 'bersama' | 'suami' | 'istri'; // SUNTIKAN KEPEMILIKAN KONTRAK
  total_log_paid?: number; 
}

export const useBills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // 1. Ambil data Bills normal
      const { data: billsData } = await supabase
        .from('bills')
        .select('*, pockets(display_name)')
        .order('due_date', { ascending: true });

      // 2. Ambil data Installments induk
      const { data: instData } = await supabase
        .from('installments')
        .select('*, pockets(display_name)')
        .order('id', { ascending: false });

      // 3. AMBIL SEMUA LOG SEJARAH UNTUK MENGHITUNG TOTAL REAL-TIME
      const { data: logsData } = await supabase
        .from('installment_logs')
        .select('installment_id, amount_paid');

      setBills((billsData || []).map((row: any) => ({
        id: Number(row.id),
        name: row.name,
        amount: Number(row.amount || 0),
        due_date: Number(row.due_date || 1),
        is_recurring: Boolean(row.is_recurring),
        status: row.status || 'unpaid',
        last_paid_at: row.last_paid_at,
        pocket_id: row.pocket_id ? Number(row.pocket_id) : null,
        pocket_name: row.pockets?.display_name || 'Tanpa Kantong'
      })));

      setInstallments((instData || []).map((row: any) => {
        const totalPaidFromLogs = (logsData || [])
          .filter((log) => Number(log.installment_id) === Number(row.id))
          .reduce((sum, log) => sum + Number(log.amount_paid), 0);

        return {
          id: Number(row.id),
          name: row.name,
          total_amount: Number(row.total_amount),
          down_payment: Number(row.down_payment || 0),
          tenor_months: Number(row.tenor_months),
          paid_months: Number(row.paid_months || 0),
          monthly_amount: Number(row.monthly_amount),
          pocket_id: row.pocket_id ? Number(row.pocket_id) : null,
          pocket_name: row.pockets?.display_name || 'Tanpa Kantong',
          ownership: row.ownership || 'bersama', // Fallback aman
          total_log_paid: totalPaidFromLogs 
        };
      }));

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addBill = async (name: string, amount: number, dueDate: number, pocketId: number) => {
    try {
      const { error } = await supabase
        .from('bills')
        .insert([{ name, amount, due_date: dueDate, pocket_id: pocketId, status: 'unpaid', is_recurring: true }]);
      if (error) throw error;
      await fetchAllData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  // KALIBRASI ACTOR: Catat siapa yang bayar rutin
  const payBill = async (bill: Bill, actor: 'suami' | 'istri' = 'suami') => {
    if (!bill.pocket_id) return { success: false, error: 'Kantong dana belum dipilih!' };
    try {
      const { data: pData } = await supabase.from('pockets').select('current_balance').eq('id', bill.pocket_id).single();
      const currentBalance = Number(pData?.current_balance || 0);
      if (currentBalance < bill.amount) return { success: false, error: 'Saldo kantong tidak cukup, Cuy!' };

      await supabase.from('pockets').update({ current_balance: currentBalance - bill.amount }).eq('id', bill.pocket_id);
      
      // SUNTIKKAN AKTOR KE JURNAL TRANSAKSI UTAMA
      await supabase.from('transactions').insert([{ 
        pocket_id: bill.pocket_id, 
        type: 'expense', 
        amount: bill.amount, 
        description: `Bayar Tagihan: ${bill.name}`,
        actor // 'suami' atau 'istri'
      }]);
      
      await supabase.from('bills').update({ status: 'paid', last_paid_at: new Date().toISOString() }).eq('id', bill.id);

      await fetchAllData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const deleteBill = async (id: number) => {
    try {
      await supabase.from('bills').delete().eq('id', id);
      setBills((prev) => prev.filter(b => b.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  // KALIBRASI OWNERSHIP: Tambah kontrak cicilan baru beserta penanggung jawab alokasi
  const addInstallment = async (name: string, total: number, dp: number, tenor: number, monthly: number, pocketId: number, ownership: string) => {
    try {
      const { error } = await supabase
        .from('installments')
        .insert([{ name, total_amount: total, down_payment: dp, tenor_months: tenor, monthly_amount: monthly, pocket_id: pocketId, paid_months: 0, ownership }]);
      if (error) throw error;
      await fetchAllData();
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  // KALIBRASI ACTOR: Bayar cicilan dinamis dengan log aktor terpusat
  const payInstallmentMonth = async (inst: Installment, customAmount: number, actor: 'suami' | 'istri' = 'suami') => {
    if (!inst.pocket_id) return { success: false, error: 'Kantong belum dipilih!' };
    if (inst.paid_months >= inst.tenor_months) return { success: false, error: 'Cicilan ini sudah lunas total, Cuy!' };

    try {
      const { data: pData } = await supabase.from('pockets').select('current_balance').eq('id', inst.pocket_id).single();
      const currentBalance = Number(pData?.current_balance || 0);
      if (currentBalance < customAmount) return { success: false, error: 'Saldo kantong tidak cukup!' };

      const nextBillingMonth = inst.paid_months + 1;

      // 1. Potong saldo kantong alokasi terkait
      await supabase.from('pockets').update({ current_balance: currentBalance - customAmount }).eq('id', inst.pocket_id);
      
      // 2. Tulis log sejarah baru ke tabel history cicilan
      await supabase.from('installment_logs').insert([{
        installment_id: inst.id,
        amount_paid: customAmount,
        billing_month: nextBillingMonth
      }]);

      // 3. Tulis log ke jurnal transaksi finansial utama dengan info aktor
      await supabase.from('transactions').insert([{
        pocket_id: inst.pocket_id,
        type: 'expense',
        amount: customAmount,
        description: `Cicilan: ${inst.name} (Bulan Ke-${nextBillingMonth}/${inst.tenor_months})`,
        actor // 'suami' atau 'istri' resmi tercatat
      }]);

      // 4. Update counter jumlah bulan di kontrak induk
      const { error } = await supabase
        .from('installments')
        .update({ paid_months: nextBillingMonth })
        .eq('id', inst.id);

      if (error) throw error;
      
      await fetchAllData(); 
      return { success: true };
    } catch (err) {
      console.error('Error executing installment payment:', err);
      return { success: false, error: err };
    }
  };

  const deleteInstallment = async (id: number) => {
    try {
      await supabase.from('installments').delete().eq('id', id);
      setInstallments((prev) => prev.filter(i => i.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  return { bills, installments, loading, addBill, payBill, deleteBill, addInstallment, payInstallmentMonth, deleteInstallment };
};