/**
 * Currency formatting utility
 * Default currency: AED (UAE Dirham)
 */

export function formatCurrency(amount: number, currency: string = 'AED'): string {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatCurrencyCompact(amount: number, currency: string = 'AED'): string {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

