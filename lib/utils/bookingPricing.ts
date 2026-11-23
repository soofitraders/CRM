/**
 * Single place that prices a booking. Used by the booking screens, the booking API and the
 * invoice creator so that the booking total and the invoice always agree.
 *
 * Meaning of "base rate": the price PER DAY, for every rental type (daily, weekly and monthly
 * rentals alike). A monthly booking is simply a longer booking: the rate typed is the per-day
 * equivalent of the monthly price (e.g. 4,250 per month = 141.66 per day) and the amount is
 * rate x number of days. This is how rates have always been entered, so staff do not change
 * anything. The rental type is a label (and is shown on the invoice).
 *
 * Days are counted from the start/end date and rounded UP (a started day is charged), with a
 * minimum of 1. With no end date the booking is 1 day.
 */

export type RentalTypeValue = 'DAILY' | 'WEEKLY' | 'MONTHLY'

const HOUR = 1000 * 60 * 60

export function countRentalUnits(
  _rentalType: RentalTypeValue,
  startDateTime: Date | string,
  endDateTime?: Date | string | null
): number {
  if (!endDateTime) return 1
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 1

  const hours = (end.getTime() - start.getTime()) / HOUR
  return Math.max(1, Math.ceil(hours / 24))
}

const round2 = (n: number) => Math.round(n * 100) / 100

export interface BookingAmountsInput {
  rentalType: RentalTypeValue
  baseRate: number
  discounts?: number
  taxPercent?: number
  startDateTime: Date | string
  endDateTime?: Date | string | null
}

export interface BookingAmounts {
  units: number
  /** baseRate x days, before discount and tax */
  rentalAmount: number
  /** rental minus discount (never below 0) */
  subtotal: number
  taxAmount: number
  /** subtotal + tax - what the booking costs */
  totalAmount: number
}

export function calculateBookingAmounts(input: BookingAmountsInput): BookingAmounts {
  const units = countRentalUnits(input.rentalType, input.startDateTime, input.endDateTime)
  const rentalAmount = round2((input.baseRate || 0) * units)
  const subtotal = round2(Math.max(0, rentalAmount - (input.discounts || 0)))
  const taxAmount = round2((subtotal * (input.taxPercent || 0)) / 100)
  return { units, rentalAmount, subtotal, taxAmount, totalAmount: round2(subtotal + taxAmount) }
}

/** "1 day", "30 days" (the rental type does not change how a booking is priced) */
export function formatRentalUnits(_rentalType: RentalTypeValue, units: number): string {
  return `${units} day${units !== 1 ? 's' : ''}`
}

/** Always "day": the rate is the price per day */
export function rentalUnitName(_rentalType: RentalTypeValue): string {
  return 'day'
}

/**
 * Tax % for an existing booking. New bookings store it; older ones are derived
 * from what was saved (tax / amount-before-tax), which works for old and new totals.
 */
export function bookingTaxPercent(booking: { taxPercent?: number; taxes?: number; totalAmount?: number }): number {
  if (typeof booking.taxPercent === 'number') return booking.taxPercent
  const taxes = booking.taxes || 0
  const beforeTax = (booking.totalAmount || 0) - taxes
  return beforeTax > 0 ? round2((taxes / beforeTax) * 100) : 0
}
