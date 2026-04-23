export function formatToLakhs(amount: number, decimals = 1): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0L';
  const lakhs = amount / 100000;
  return `₹${lakhs.toFixed(decimals)}L`;
}

export function formatCurrency(amount: number): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatToLakhsSmart(amount: number): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0L';
  const lakhs = amount / 100000;
  if (lakhs < 1) return `₹${lakhs.toFixed(2)}L`;
  if (lakhs < 10) return `₹${lakhs.toFixed(1)}L`;
  return `₹${lakhs.toFixed(0)}L`;
}

export function parseLakhs(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[₹L,\s]/g, '');
  const lakhs = parseFloat(cleaned);
  return isNaN(lakhs) ? 0 : lakhs * 100000;
}

export function formatPercentage(value: number, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function getMonthName(month: number, format: 'short' | 'long' = 'short'): string {
  const date = new Date(2026, month - 1);
  return date.toLocaleString('default', { month: format });
}
