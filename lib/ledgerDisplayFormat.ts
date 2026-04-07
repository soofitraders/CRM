/** Deterministic formatting for ledger UI (consistent server/client output). */

export function formatLedgerAmount(n: number | undefined | null): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '0.00'
  const [intPart, frac = '00'] = v.toFixed(2).split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${withCommas}.${frac}`
}

/** Parse YYYY-MM-DD prefix or ISO → DD/MM/YYYY without locale-sensitive Date rendering. */
export function formatLedgerDateOnly(iso: string): string {
  if (!iso) return '—'
  const head = iso.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(head)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const t = Date.parse(head)
  if (!Number.isNaN(t)) {
    const ymd = new Date(t).toISOString().slice(0, 10)
    const [y, mo, d] = ymd.split('-')
    return `${d}/${mo}/${y}`
  }
  return head
}

/** Show UTC wall time from full ISO; date-only strings use calendar date only. */
export function formatLedgerDateTimeUtc(iso: string): string {
  if (!iso) return '—'
  const s = iso.trim()
  if (s.includes('T')) {
    return `${s.slice(0, 19).replace('T', ' ')} UTC`
  }
  return formatLedgerDateOnly(s)
}
