export const statusLabel: Record<string, string> = {
  pending: 'بانتظار مندوب',
  assigned: 'تم التعيين',
  picked_up: 'تم الاستلام',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

export function statusClass(s: string): string {
  if (s === 'pending') return 'chip amber';
  if (s === 'cancelled') return 'chip red';
  if (s === 'delivered') return 'chip';
  return 'chip green';
}

export function money(v: string | number | null | undefined): string {
  return Number(v ?? 0).toFixed(2);
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}
