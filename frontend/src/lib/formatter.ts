/**
 * Mengubah angka menjadi format Rupiah (IDR) tanpa desimal.
 * Contoh: 1000000 -> Rp1.000.000
 */
export const formatIDR = (amount: number | string): string => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return 'Rp0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(numericAmount);
};

/**
 * Mengubah string tanggal/timestamp menjadi format lokal Indonesia yang rapi.
 * Contoh: 2026-05-28 -> 28 Mei 2026
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};