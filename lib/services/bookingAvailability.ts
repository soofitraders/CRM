import mongoose from 'mongoose'
import Booking from '@/lib/models/Booking'

/**
 * A car can only be in one place at a time.
 *
 * Bookings that "hold" a car: PENDING, CONFIRMED, CHECKED_OUT.
 * They do NOT hold it once CANCELLED or CHECKED_IN (car is back).
 *
 * Two bookings clash when their time ranges overlap. Back-to-back is allowed:
 * a booking that starts at the exact moment another ends does not clash.
 * A booking with no end date (open-ended) holds the car from its start onwards.
 */
export const BLOCKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_OUT'] as const

/** Mongo filter for "existing booking overlaps [start, end)" (end optional = open-ended). */
export function overlapFilter(start: Date, end?: Date | null) {
  const filter: any = {
    // existing booking ends after the new one starts (or never ends)
    $or: [{ endDateTime: { $gt: start } }, { endDateTime: null }, { endDateTime: { $exists: false } }],
  }
  // existing booking starts before the new one ends (a new open-ended booking has no upper limit)
  if (end) filter.startDateTime = { $lt: end }
  return filter
}

export interface ConflictQuery {
  vehicleId: string
  startDateTime: Date | string
  endDateTime?: Date | string | null
  excludeBookingId?: string
}

/** First active booking of this car that overlaps the given dates, or null. */
export async function findConflictingBooking(q: ConflictQuery): Promise<any | null> {
  const start = new Date(q.startDateTime)
  const end = q.endDateTime ? new Date(q.endDateTime) : null
  const filter: any = {
    vehicle: new mongoose.Types.ObjectId(q.vehicleId),
    status: { $in: BLOCKING_STATUSES },
    ...overlapFilter(start, end),
  }
  if (q.excludeBookingId) filter._id = { $ne: new mongoose.Types.ObjectId(q.excludeBookingId) }
  return Booking.findOne(filter).sort({ startDateTime: 1 }).lean()
}

/**
 * Race safety: if two requests passed the check at the same moment, the booking
 * created FIRST keeps the car. Call this after saving; true means "someone else
 * got there first" and the caller should remove its own booking.
 */
export async function hasOlderConflict(booking: any): Promise<boolean> {
  const filter: any = {
    vehicle: booking.vehicle,
    status: { $in: BLOCKING_STATUSES },
    _id: { $lt: booking._id },
    ...overlapFilter(new Date(booking.startDateTime), booking.endDateTime ? new Date(booking.endDateTime) : null),
  }
  return (await Booking.exists(filter)) !== null
}

const fmt = (d: any) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

/** Plain-English message naming the car and the booking it clashes with. */
export function conflictMessage(vehicleLabel: string, conflict: any): string {
  const ref = String(conflict._id).slice(-6).toUpperCase()
  const range = conflict.endDateTime ? `${fmt(conflict.startDateTime)} to ${fmt(conflict.endDateTime)}` : `from ${fmt(conflict.startDateTime)} (no end date)`
  return `${vehicleLabel} is already booked ${range} (Booking #${ref}). Please choose other dates or another car.`
}
