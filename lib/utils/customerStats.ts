import connectDB from '@/lib/db'
import Booking from '@/lib/models/Booking'
import Payment from '@/lib/models/Payment'
import FineOrPenalty from '@/lib/models/FineOrPenalty'

export interface CustomerStats {
  activeBookings: number
  totalBookings: number
  lastBookingDate: Date | null
  totalPayments: number
  totalFines: number
  paidFines: number
  pendingFines: number
}

/**
 * Get customer statistics including booking counts, payments, and fines
 */
export async function getCustomerStats(customerId: string): Promise<CustomerStats> {
  await connectDB()

  const activeBookings = await Booking.countDocuments({
    customer: customerId,
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_OUT'] },
  })

  const totalBookings = await Booking.countDocuments({
    customer: customerId,
  })

  const lastBooking = await Booking.findOne({ customer: customerId })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean()

  // Get total payments
  const bookings = await Booking.find({ customer: customerId }).select('_id').lean()
  const bookingIds = bookings.map((b) => b._id)

  const paymentsResult = await Payment.aggregate([
    {
      $match: {
        booking: { $in: bookingIds },
        status: 'SUCCESS',
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ])

  // Get fines
  const finesResult = await FineOrPenalty.aggregate([
    {
      $match: {
        customer: customerId,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        paid: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0],
          },
        },
      },
    },
  ])

  return {
    activeBookings,
    totalBookings,
    lastBookingDate: lastBooking?.createdAt || null,
    totalPayments: paymentsResult[0]?.total || 0,
    totalFines: finesResult[0]?.total || 0,
    paidFines: finesResult[0]?.paid || 0,
    pendingFines: (finesResult[0]?.total || 0) - (finesResult[0]?.paid || 0),
  }
}

