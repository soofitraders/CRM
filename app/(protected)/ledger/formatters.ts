export const fmtAED = (val: number | undefined | null): string => {
  const n = Number(val ?? 0)
  if (Number.isNaN(n)) return 'AED 0.00'
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const fmtDate = (val: string | Date | undefined): string => {
  if (!val) return '—'
  try {
    return new Date(val).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}
