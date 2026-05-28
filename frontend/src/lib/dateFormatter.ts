/**
 * Helper untuk mengubah string ISO Date dari Supabase menjadi format bahasa Indonesia yang rapi.
 * Contoh: "2026-05-28T09:07:27.050Z" -> "28 Mei 2026 16:07"
 */
export const formatDateIndo = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB';
};