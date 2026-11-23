/**
 * Central "who may open what" rules, enforced in middleware.ts for EVERY request
 * (so a missing check inside one API route can never expose data to the wrong role).
 *
 * Staff roles (SUPER_ADMIN, ADMIN, MANAGER, SALES_AGENT, FINANCE, ...) are not restricted
 * here: their access is decided by the checks inside each API route.
 *
 *  - CUSTOMER: no portal exists, so a customer may not use ANY page or API
 *    (customers can no longer sign in; this also stops sessions issued earlier).
 *  - INVESTOR: only their own investor screens. Everything about bookings, customers,
 *    invoices, payments, vehicles, expenses, ledger, reports, users, ... is closed.
 *    (The investor routes themselves limit the data to the investor's OWN records.)
 */

const INVESTOR_API_ALLOW = [
  '/api/auth',
  '/api/investors',
  '/api/investor-payouts',
  '/api/notifications',
  '/api/settings', // company name / logo shown in the header
  '/api/support-tickets',
  '/api/sessions',
  '/api/users/me',
]

const INVESTOR_PAGE_ALLOW = ['/', '/investors', '/support']

const startsWithPath = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/')

export function isApiAllowed(role: string | undefined, path: string): boolean {
  if (startsWithPath(path, '/api/auth')) return true // sign-in / sign-out / session
  if (role === 'CUSTOMER') return false
  if (role === 'INVESTOR') return INVESTOR_API_ALLOW.some((p) => startsWithPath(path, p))
  return true
}

export function isPageAllowed(role: string | undefined, path: string): boolean {
  if (role === 'CUSTOMER') return false
  if (role === 'INVESTOR') return INVESTOR_PAGE_ALLOW.some((p) => startsWithPath(path, p))
  return true
}

/** Where a signed-in user of this role should land when they open something they may not use. */
export function homePathFor(role: string | undefined): string {
  return role === 'INVESTOR' ? '/investors' : '/dashboard'
}
