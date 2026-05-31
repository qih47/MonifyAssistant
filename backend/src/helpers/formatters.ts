export const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

export function formatPocketName(name: string): string {
    return name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}
