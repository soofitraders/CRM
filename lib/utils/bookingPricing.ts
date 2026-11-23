import { addMonths } from 'date-fns'

/**
 * Single place that prices a booking. Used by the booking screens, the booking
 * API and the invoice creator so that the booking total and the invoice always
 * agree.
 *
 * Meaning of "base rate": the price PER RENTAL UNIT of the booking's rental type
 *   DAILY   -> price per day
 *   WEEKLY  -> price per week
 *   MONTHLY -> price per month
 *
 * Units are counted from the start/end date and rounded UP (a started day / week
 * / month is charged), with a minimum of 1. With no end date the booking is 1 unit.
 */

export type RentalTypeValue = 'DAILY' | 'WEEKLY' | 'MONTHLY'

const HOUR = 1000 * 60 * 60

export function countRentalUnits(
  rentalType: RentalTypeValue,
  startDateTime: Date | string,
  endDateTime?: Date | string | null
): number {
  if (!endDateTime) return 1
  const start = new Date(startDateTime)
  const end = new Date(endDateTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 1

  const hours = (end.getTime() - start.getTime()) / HOUR

  if (rentalType === 'WEEKLY') return Math.max(1, Math.ceil(hours / (24 * 7)))

  if (rentalType === 'MONTHLY') {
    // Calendar months: Mar 1 -> Apr 1 is exactly 1 month, Mar 1 -> Mar 31 is 1 (started) month
    let fullMonths = 0
    while (addMonths(start, fullMonths + 1) <= end) fullMonths++
    const hasPartMonth = end > addMonths(start, fullMonths)
    return Math.max(1, fullMonths + (hasPartMonth ? 1 : 0))
  }

  return Math.max(1, Math.ceil(hours / 24)) // DAILY
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
  /** baseRate x units, before discount and tax */
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

/** "3 days", "1 week", "2 months" */
export function formatRentalUnits(rentalType: RentalTypeValue, units: number): string {
  const word = rentalType === 'WEEKLY' ? 'week' : rentalType === 'MONTHLY' ? 'month' : 'day'
  return `${units} ${word}${units !== 1 ? 's' : ''}`
}

/** "day" | "week" | "month" */
export function rentalUnitName(rentalType: RentalTypeValue): string {
  return rentalType === 'WEEKLY' ? 'week' : rentalType === 'MONTHLY' ? 'month' : 'day'
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
