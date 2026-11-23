/**
 * Booking rules shared by the server and the screens.
 *
 * Life of a booking:
 *
 *   PENDING --> CONFIRMED --> CHECKED_OUT --> CHECKED_IN   (car handed over, then returned)
 *      \            \
 *       +-> CANCELLED <-+                                  (only before the car leaves)
 *
 *  - CHECKED_IN and CANCELLED are final: nothing can follow them.
 *  - A booking cannot skip a step (e.g. PENDING straight to CHECKED_IN)
 *    and cannot go backwards (e.g. CHECKED_OUT back to PENDING).
 */
export type BookingStatusValue = 'PENDING' | 'CONFIRMED' | 'CHECKED_OUT' | 'CHECKED_IN' | 'CANCELLED'

export const ALLOWED_NEXT_STATUS: Record<BookingStatusValue, BookingStatusValue[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_OUT', 'CANCELLED'],
  CHECKED_OUT: ['CHECKED_IN'],
  CHECKED_IN: [],
  CANCELLED: [],
}

/** Statuses a new booking may be created with */
export const CREATE_STATUSES: BookingStatusValue[] = ['PENDING', 'CONFIRMED']

const LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_OUT: 'Checked Out',
  CHECKED_IN: 'Checked In',
  CANCELLED: 'Cancelled',
}
export const statusLabel = (s: string) => LABEL[s] || s

/** Same status = no change = fine */
export function canMoveBooking(from: string, to: string): boolean {
  if (from === to) return true
  return (ALLOWED_NEXT_STATUS[from as BookingStatusValue] || []).includes(to as BookingStatusValue)
}

/** The current status plus every status it may move to (for dropdowns) */
export function statusChoices(current: string): BookingStatusValue[] {
  return [current as BookingStatusValue, ...(ALLOWED_NEXT_STATUS[current as BookingStatusValue] || [])]
}

export function transitionMessage(from: string, to: string): string {
  const next = ALLOWED_NEXT_STATUS[from as BookingStatusValue] || []
  const options = next.length ? `From ${statusLabel(from)} it can only go to: ${next.map(statusLabel).join(' or ')}.` : `A ${statusLabel(from)} booking is final and cannot be changed to another status.`
  return `A booking cannot go from ${statusLabel(from)} to ${statusLabel(to)}. ${options}`
}

/** True when the start is earlier than the start of today (entering a rental for earlier today is fine) */
export function startsBeforeToday(start: Date | string): boolean {
  const d = new Date(start)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d.getTime() < today.getTime()
}

export const PAST_START_MESSAGE =
  'The start date cannot be in the past. Pick today or a later date (only an Admin can enter an earlier date).'

export function depositMessage(deposit: number, total: number): string {
  return `The deposit (AED ${deposit.toFixed(2)}) cannot be more than the booking total (AED ${total.toFixed(2)}).`
}
